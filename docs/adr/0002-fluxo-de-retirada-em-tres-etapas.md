# Fluxo de retirada em três etapas

O fluxo principal da Tokyo Sushi será apresentado como `Recebidos`, `Aceitos` e `Prontos`, porque a operação é feita por uma única pessoa e trabalha somente com retirada. Para preservar o histórico e a compatibilidade dos dados existentes, a etapa visível `Aceitos` continua usando internamente o status persistido `Preparando`; a baixa no balcão grava `Finalizado` e retira o pedido do fluxo ativo.
