import { Module } from "@nestjs/common";
import { FilesController } from "./presentation/controllers/files.controller";
import { FilesService } from "./application/services/files.service";
import { FileScanner } from "./domain/file-scanner";
import { SignatureFileScanner } from "./domain/signature-file-scanner";
import { createFileScanner } from "./domain/file-scanner.factory";

// StorageProvider comes from the global SupabaseModule. The scanner is the signature check,
// plus ClamAV (clamd over TCP) when CLAMAV_HOST is set.
@Module({
  controllers: [FilesController],
  providers: [FilesService, SignatureFileScanner, { provide: FileScanner, useFactory: createFileScanner, inject: [SignatureFileScanner] }],
})
export class FilesModule {}
