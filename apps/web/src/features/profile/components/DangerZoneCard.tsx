"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/shared/ui/primitives/Card";
import { Button } from "@/shared/ui/primitives/Button";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

export function DangerZoneCard() {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Danger Zone</CardTitle>
        <CardDescription>Permanently delete your account and all associated data.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Delete account
        </Button>
      </CardContent>
      <DeleteAccountDialog open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}
