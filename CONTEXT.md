# Domain Context

## Canonical terms

### Processo de carreira
Processo de Progressão ou Promoção comum. Possui origem, destino e interstício próprios e não deve ser usado para representar RSC ou Classe Titular.

### Processo RSC
Solicitação de Reconhecimento de Saberes e Competências para equivalência exclusivamente remuneratória. Usa `CareerProcess` como raiz compartilhada e `RscProcessDetail` para nível, período, relatório e resultado próprios.

### Nível pretendido do RSC
Um entre RSC-I, RSC-II e RSC-III. A habilitação mínima é, respectivamente, graduação, especialização e mestrado. A decisão usa 60 pontos totais e pelo menos 36 pontos no nível pretendido.

### Período de atividades do RSC
Intervalo declarado pelo docente para as atividades apresentadas. Pode começar no máximo cinco anos antes do ingresso na carreira EBTT. Quando existe concessão anterior, começa nessa concessão ou depois e termina após pelo menos três anos.

### Declaração de veracidade do RSC
Aceite registrado com data no processo, pelo qual o docente confirma que os dados e períodos correspondem aos documentos comprobatórios.

### Comissão Especial
Comissão de quatro avaliadores usada no RSC e na Classe Titular: um membro interno e três externos titulares. A comissão só pode ser ativada após portaria e aceite de todos.

### Declaração de ausência de conflito
Registro obrigatório no aceite do convite do avaliador. A recusa exige motivo auditável. O requerente nunca pode avaliar o próprio processo.

### Promoção à Classe Titular
Processo próprio, diferente da Promoção comum. Só pode ser aberto por docente em C4 após 12 meses completos; a concessão aprovada exige 24 meses completos em C4.

## Invariantes

- RSC e Classe Titular não devem adquirir campos obrigatórios exclusivos de Progressão/Promoção.
- Cálculos de pontuação e resultados são autoritativos no servidor; valores enviados pelo cliente não são confiáveis.
- Critério RSC pontuado exige comprovante PDF.
- Um usuário só pode manter um processo ativo do mesmo tipo configurado.
- Processos concluídos e o histórico de status não são reescritos para se adaptar a regras novas.
- Integrações automáticas com SIPAC/SIMEC, GECC e processos administrativos genéricos estão fora do escopo atual.

## Fontes normativas locais

As cópias e análises de regulamentos, formulários e orientações estão em `Documentacao/`. Em caso de divergência, preservar a regra versionada e não inventar critérios ou pontuações.
