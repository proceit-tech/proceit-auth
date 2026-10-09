# Banco de dados — scripts versionados

Padrão `REQ-AAAA-NNN-001-up.sql` e, quando seguro, `REQ-AAAA-NNN-001-down.sql`. Incrementar 002, 003... para novas alterações no mesmo requisito.
Cada SQL deve conter comentário inicial com requisito, objetivo, banco/dialeto, dependências, ordem de execução e estratégia de rollback. Nunca reescrever migração já aplicada em produção; criar a próxima versão.
Documentar pré-condições, backfill, índices, constraints, acesso por tenant, transação, impacto operacional e testes de validação. Se rollback não for seguro, NÃO inventá-lo: registrar procedimento de recuperação e motivação no requisito/TST.
Não colocar credenciais nem dados reais sensíveis. Arquivos SQL de exemplo só serão criados quando houver mudança real de banco.
