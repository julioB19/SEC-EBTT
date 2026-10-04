ALTER TABLE `special_commission_member`
  ADD COLUMN `conflictDeclarationAt` DATETIME(3) NULL,
  ADD COLUMN `responseReason` VARCHAR(1000) NULL;
