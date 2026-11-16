import { Module } from "@nestjs/common";
import { FilesController } from "./presentation/controllers/files.controller";
import { FilesService } from "./application/services/files.service";
import { FileScanner } from "./domain/file-scanner";
import { SignatureFileScanner } from "./domain/signature-file-scanner";

// StorageProvider comes from the global SupabaseModule. Swap the FileScanner binding below
// for a real antivirus implementation when one is available.
@Module({
  controllers: [FilesController],
  providers: [FilesService, { provide: FileScanner, useClass: SignatureFileScanner }],
})
export class FilesModule {}
