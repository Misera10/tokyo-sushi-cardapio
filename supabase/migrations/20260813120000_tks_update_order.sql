create or replace function public.tks_update_order(p_order_id bigint, p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing_order public.tks_orders%rowtype;
  updated_order public.tks_orders%rowtype;
  customer_name_value text;
  customer_phone_value text;
  payment_value text;
  notes_value text;
  pricing jsonb := '{}'::jsonb;
  discount_type_value text := 'none';
  surcharge_type_value text := 'none';
  discount_input numeric(10,2) := 0;
  surcharge_input numeric(10,2) := 0;
  input_items jsonb;
  item_row record;
  option_row record;
  product_row public.tks_products%rowtype;
  complement_row public.tks_complements%rowtype;
  validation_group record;
  complement_item jsonb;
  item_options jsonb;
  sanitized_items jsonb := '[]'::jsonb;
  product_id bigint;
  group_id bigint;
  option_id bigint;
  item_quantity integer;
  option_quantity integer;
  group_quantity integer;
  base_price numeric(10,2);
  extras_total numeric(10,2);
  line_total numeric(10,2);
  subtotal_value numeric(10,2) := 0;
  discount_amount_value numeric(10,2) := 0;
  coupon_discount_amount_value numeric(10,2) := 0;
  surcharge_amount_value numeric(10,2) := 0;
  amount_received_value numeric(10,2);
  change_amount_value numeric(10,2) := 0;
  total_value numeric(10,2) := 0;
begin
  if not public.tks_is_admin() then
    raise exception using errcode = '42501', message = 'Acesso negado.';
  end if;
  if p_order is null or jsonb_typeof(p_order) <> 'object' then
    raise exception using errcode = '22023', message = 'Pedido inválido.';
  end if;

  select * into existing_order
  from public.tks_orders
  where id = p_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Pedido não encontrado.';
  end if;
  if existing_order.archived_at is not null or existing_order.status in ('Finalizado', 'Cancelado') then
    raise exception using errcode = '22023', message = 'Pedidos finalizados ou cancelados não podem ser editados.';
  end if;

  customer_name_value := trim(coalesce(p_order->>'customer_name', existing_order.customer_name));
  customer_phone_value := regexp_replace(coalesce(p_order->>'customer_phone', existing_order.customer_phone), '[^0-9]', '', 'g');
  payment_value := trim(coalesce(nullif(p_order->>'payment', ''), existing_order.payment));
  notes_value := trim(coalesce(p_order->>'notes', existing_order.notes));
  input_items := coalesce(p_order->'items', '[]'::jsonb);
  pricing := coalesce(p_order->'pricing', '{}'::jsonb);

  if char_length(customer_name_value) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'Nome do cliente inválido.';
  end if;
  if char_length(customer_phone_value) not between 10 and 15 then
    raise exception using errcode = '22023', message = 'Celular do cliente inválido.';
  end if;
  if char_length(notes_value) > 1000 then
    raise exception using errcode = '22023', message = 'Observação muito longa.';
  end if;
  if jsonb_typeof(input_items) <> 'array' or jsonb_array_length(input_items) not between 1 and 50 then
    raise exception using errcode = '22023', message = 'O pedido precisa ter entre 1 e 50 itens.';
  end if;

  for item_row in select value from jsonb_array_elements(input_items) as item(value) loop
    begin
      product_id := (item_row.value->>'id')::bigint;
      item_quantity := (item_row.value->>'qty')::integer;
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'Produto ou quantidade inválida.';
    end;
    if item_quantity not between 1 and 50 then
      raise exception using errcode = '22023', message = 'Quantidade de produto inválida.';
    end if;
    if jsonb_typeof(coalesce(item_row.value->'options', '[]'::jsonb)) <> 'array' then
      raise exception using errcode = '22023', message = 'Adicionais inválidos.';
    end if;

    select * into product_row
    from public.tks_products candidate_product
    where candidate_product.id = product_id
      and (candidate_product.active = true or exists (
        select 1 from jsonb_array_elements(coalesce(existing_order.items, '[]'::jsonb)) old_item(value)
        where (old_item.value->>'id')::bigint = product_id
      ));
    if not found then
      raise exception using errcode = '22023', message = 'Produto indisponível.';
    end if;

    base_price := round(coalesce(product_row.price, 0), 2);
    extras_total := 0;
    item_options := '[]'::jsonb;
    for option_row in select value from jsonb_array_elements(coalesce(item_row.value->'options', '[]'::jsonb)) as option(value) loop
      begin
        group_id := (option_row.value->>'groupId')::bigint;
        option_id := (option_row.value->>'itemId')::bigint;
        option_quantity := (option_row.value->>'qty')::integer;
      exception when invalid_text_representation then
        raise exception using errcode = '22023', message = 'Adicional inválido.';
      end;
      if option_quantity not between 1 and 50 then
        raise exception using errcode = '22023', message = 'Quantidade de adicional inválida.';
      end if;

      select * into complement_row
      from public.tks_complements candidate_group
      where candidate_group.id = group_id
        and candidate_group.active = true
        and (
          exists (
            select 1 from jsonb_array_elements_text(coalesce(candidate_group.linked_product_ids, '[]'::jsonb)) linked(linked_product_id)
            where linked.linked_product_id = product_id::text
          )
          or (
            lower(trim(coalesce(product_row.cat, ''))) not in ('bebidas', 'combos')
            and 'pdv-global' in (select jsonb_array_elements_text(coalesce(candidate_group.tags, '[]'::jsonb)))
          )
        );
      if not found then
        raise exception using errcode = '22023', message = 'Grupo de adicional inválido.';
      end if;

      select value into complement_item
      from jsonb_array_elements(coalesce(complement_row.items, '[]'::jsonb)) item(value)
      where (value->>'id')::bigint = option_id
        and coalesce((value->>'active')::boolean, true) = true
      limit 1;
      if complement_item is null then
        raise exception using errcode = '22023', message = 'Adicional indisponível.';
      end if;

      extras_total := extras_total + round(coalesce((complement_item->>'price')::numeric, 0), 2) * option_quantity;
      item_options := item_options || jsonb_build_array(jsonb_build_object(
        'groupId', group_id,
        'groupName', complement_row.name,
        'itemId', option_id,
        'name', complement_item->>'name',
        'price', round(coalesce((complement_item->>'price')::numeric, 0), 2),
        'qty', option_quantity
      ));
    end loop;

    for validation_group in
      select candidate_group.id, candidate_group.min_qty, candidate_group.max_qty
      from public.tks_complements candidate_group
      where candidate_group.active = true
        and (
          exists (
            select 1 from jsonb_array_elements_text(coalesce(candidate_group.linked_product_ids, '[]'::jsonb)) linked(linked_product_id)
            where linked.linked_product_id = product_id::text
          )
          or (
            lower(trim(coalesce(product_row.cat, ''))) not in ('bebidas', 'combos')
            and 'pdv-global' in (select jsonb_array_elements_text(coalesce(candidate_group.tags, '[]'::jsonb)))
          )
        )
    loop
      select coalesce(sum((value->>'qty')::integer), 0) into group_quantity
      from jsonb_array_elements(item_options) selected(value)
      where (value->>'groupId')::bigint = validation_group.id;
      if group_quantity < coalesce(validation_group.min_qty, 0) or group_quantity > coalesce(validation_group.max_qty, 100) then
        raise exception using errcode = '22023', message = 'Quantidade de adicionais inválida.';
      end if;
    end loop;

    line_total := round((base_price + extras_total) * item_quantity, 2);
    subtotal_value := subtotal_value + line_total;
    sanitized_items := sanitized_items || jsonb_build_array(jsonb_build_object(
      'id', product_row.id,
      'name', product_row.name,
      'price', round(base_price + extras_total, 2),
      'basePrice', base_price,
      'qty', item_quantity,
      'options', item_options
    ));
  end loop;

  subtotal_value := round(subtotal_value, 2);
  discount_type_value := lower(coalesce(nullif(trim(pricing->>'discount_type'), ''), 'none'));
  surcharge_type_value := lower(coalesce(nullif(trim(pricing->>'surcharge_type'), ''), 'none'));
  discount_input := greatest(coalesce(nullif(pricing->>'discount_value', '')::numeric, 0), 0);
  surcharge_input := greatest(coalesce(nullif(pricing->>'surcharge_value', '')::numeric, 0), 0);
  if discount_type_value not in ('none', 'fixed', 'percent') or surcharge_type_value not in ('none', 'fixed', 'percent') then
    raise exception using errcode = '22023', message = 'Tipo de ajuste inválido.';
  end if;
  if discount_type_value = 'percent' and discount_input > 100 then
    raise exception using errcode = '22023', message = 'O desconto percentual não pode passar de 100%.';
  end if;
  if surcharge_type_value = 'percent' and surcharge_input > 100 then
    raise exception using errcode = '22023', message = 'O acréscimo percentual não pode passar de 100%.';
  end if;
  discount_amount_value := case
    when discount_type_value = 'percent' then round(subtotal_value * discount_input / 100, 2)
    when discount_type_value = 'fixed' then least(discount_input, subtotal_value)
    else 0
  end;
  coupon_discount_amount_value := least(greatest(coalesce(existing_order.coupon_discount_amount, 0), 0), greatest(subtotal_value - discount_amount_value, 0));
  surcharge_amount_value := case
    when surcharge_type_value = 'percent' then round(greatest(subtotal_value - discount_amount_value - coupon_discount_amount_value, 0) * surcharge_input / 100, 2)
    when surcharge_type_value = 'fixed' then surcharge_input
    else 0
  end;
  total_value := round(greatest(subtotal_value - discount_amount_value - coupon_discount_amount_value, 0) + surcharge_amount_value, 2);
  amount_received_value := existing_order.amount_received;
  if lower(payment_value) = 'dinheiro' then
    if amount_received_value is null or amount_received_value < total_value then
      raise exception using errcode = '22023', message = 'O valor recebido precisa ser revisado para o novo total.';
    end if;
    change_amount_value := round(amount_received_value - total_value, 2);
  else
    amount_received_value := null;
    change_amount_value := 0;
  end if;

  update public.tks_orders
  set customer_name = customer_name_value,
      customer_phone = customer_phone_value,
      payment = payment_value,
      notes = notes_value,
      subtotal = subtotal_value,
      discount_amount = discount_amount_value,
      coupon_discount_amount = coupon_discount_amount_value,
      surcharge_amount = surcharge_amount_value,
      amount_received = amount_received_value,
      change_amount = change_amount_value,
      total = total_value,
      items = sanitized_items
  where id = p_order_id
  returning * into updated_order;

  return jsonb_build_object(
    'id', updated_order.id,
    'created_at', updated_order.created_at,
    'status', updated_order.status,
    'customer_name', updated_order.customer_name,
    'customer_phone', updated_order.customer_phone,
    'payment', updated_order.payment,
    'payment_status', updated_order.payment_status,
    'notes', updated_order.notes,
    'subtotal', updated_order.subtotal,
    'discount_amount', updated_order.discount_amount,
    'coupon_code', updated_order.coupon_code,
    'coupon_discount_amount', updated_order.coupon_discount_amount,
    'surcharge_amount', updated_order.surcharge_amount,
    'amount_received', updated_order.amount_received,
    'change_amount', updated_order.change_amount,
    'total', updated_order.total,
    'items', updated_order.items,
    'order_source', updated_order.order_source,
    'client_request_id', updated_order.client_request_id,
    'archived_at', updated_order.archived_at
  );
end;
$$;

revoke all on function public.tks_update_order(bigint, jsonb) from public;
grant execute on function public.tks_update_order(bigint, jsonb) to authenticated;
