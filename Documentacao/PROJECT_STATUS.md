# SEC-EBTT — estado atual

Atualizado em 17/10/2026.

Os itens de implementação do checklist dos quatro processos foram concluídos e verificados: Progressão, Promoção, RSC e Classe Titular. As alterações foram aplicadas ao repositório original e as 23 migrações estão instaladas no banco local. Sete usuários e cinco processos foram preservados, com backup SQL anterior à atualização.

- 36 suítes e 220 testes aprovados, com cobertura integral de 81,37% e cobertura regulatória de 88,18% das linhas/instruções.
- Build/lint do backend e build/tipos do frontend aprovados.
- Regras de elegibilidade, datas financeiras, sete indicados, calendário, documentos, assinaturas, auditoria, recursos RSC e administração de versões implementados.
- Os testes permanecem no MySQL isolado; os processos históricos do banco principal são preservados.
- Mantida autenticação por CPF e senha, conforme RF-GER-01. GECC, processos simples e integrações automáticas externas continuam fora do escopo.

Detalhes: [Checklist](checklist-adequacao-cppd.md) e [Conclusão e instruções de uso](conclusao-quatro-processos-2026-10-17.md).


## Rodada de navegador de 17/10/2026

31 cenários aprovados após correções e retestes nos quatro perfis. Corrigidas datas civis, data financeira na prévia/conclusão do parecer, acesso à biblioteca pelo perfil e atualização imediata do diploma selecionado. Regressão: 220 testes em 36 suítes aprovados. Consulte o relatório de navegador para o alcance exato e as evidências.
