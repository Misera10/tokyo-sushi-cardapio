insert into public.tks_settings (key, value, updated_at)
values (
  'menu_groups',
  '[
    {"id":"group-combos","name":"Combos","sortOrder":0,"active":true,"description":""},
    {"id":"group-hossomaki","name":"Hossomaki","sortOrder":1,"active":true,"description":""},
    {"id":"group-hot-filadelfia","name":"Hot Filadélfia","sortOrder":2,"active":true,"description":""},
    {"id":"group-temakis","name":"Temakis","sortOrder":3,"active":true,"description":""},
    {"id":"group-sushi-dog","name":"Sushi Dog","sortOrder":4,"active":true,"description":""},
    {"id":"group-mini-sushi-dog","name":"Mini Sushi Dog","sortOrder":5,"active":true,"description":""},
    {"id":"group-fitness","name":"Peças Fitness (Low Carb)","sortOrder":6,"active":true,"description":""},
    {"id":"group-premium","name":"Peças Premium","sortOrder":7,"active":true,"description":""},
    {"id":"group-bebidas","name":"Bebidas","sortOrder":8,"active":true,"description":""}
  ]'::jsonb,
  now()
)
on conflict (key) do nothing;
