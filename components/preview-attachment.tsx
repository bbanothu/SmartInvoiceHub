import type { Attachment } from 'ai';
import { FileIcon, ImageIcon } from 'lucide-react';
import Image from 'next/image';

export function PreviewAttachment({
  attachment,
}: {
  attachment: Attachment;
}) {
  const isImage = attachment.contentType?.startsWith('image/');
  const isPDF = attachment.contentType === 'application/pdf';
  const fileName = attachment.name || 'Unnamed file';

  if (isImage) {
    return (
      <div className="relative h-32 w-32 overflow-hidden rounded-lg">
        <Image
          src={attachment.url}
          alt={fileName}
          fill
          className="object-cover"
        />
      </div>
    );
  }

  if (isPDF) {
    return (
      <div className="flex items-center gap-2 rounded-lg border p-2">
        <FileIcon className="h-6 w-6 text-red-500" />
        <span className="text-sm">{fileName}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border p-2">
      <FileIcon className="h-6 w-6 text-gray-500" />
      <span className="text-sm">{fileName}</span>
    </div>
  );
}
