ALTER TABLE `rsc_process_detail`
  ADD COLUMN `careerEntryDate` DATETIME(3) NULL,
  ADD COLUMN `previousRscGrantedAt` DATETIME(3) NULL,
  ADD COLUMN `activityPeriodStart` DATETIME(3) NULL,
  ADD COLUMN `activityPeriodEnd` DATETIME(3) NULL,
  ADD COLUMN `truthDeclarationAcceptedAt` DATETIME(3) NULL;
