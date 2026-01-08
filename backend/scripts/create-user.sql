INSERT INTO User (
	name, 
	phone, 
	email,
	cpf,
	password,
	role,
	createdDate,
	updatedDate
) VALUES (
	'RootUser',
	'',
	'rootUser@email.com',
	'000.000.000-00',
	'$2b$10$QglT2nJF1Nqr.0ESTBxI1uV8hWtn0d4cmGhyJeXUSq5Q6b8sD7P0C',
	'SYSTEM_ADMIN',
	CURRENT_TIMESTAMP,
	CURRENT_TIMESTAMP
);