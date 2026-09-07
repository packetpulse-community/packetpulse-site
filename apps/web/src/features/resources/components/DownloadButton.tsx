"use client";

import { useMutation } from "@tanstack/react-query";
import { cn } from "@/shared/utils/cn";
import { buttonVariants } from "@/shared/ui/primitives/Button";
import { resourcesClientApi } from "../api/resources.api";

export function DownloadButton({ resourceId, href, label }: { resourceId: string; href: string; label: string }) {
  const mutation = useMutation({ mutationFn: () => resourcesClientApi.incrementDownload(resourceId) });

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={() => mutation.mutate()}
      className={cn(buttonVariants({ variant: "gradient" }), "w-fit")}
    >
      {label}
    </a>
  );
}
