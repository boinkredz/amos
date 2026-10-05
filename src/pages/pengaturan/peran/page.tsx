import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { toast } from "sonner";
import { ExternalLink, ShieldCheck, Smartphone, Unlock, UserPlus } from "lucide-react";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel";
import PageHeader from "@/components/page-header.tsx";
import { useRole } from "@/hooks/use-role.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { ROLES, ROLE_LABELS, ROLE_LEVEL, DEVICE_LOCKED_ROLES } from "@/convex/schema/users";
import type { Role } from "@/convex/schema/users";

export default function PeranPage() {
  const { isAdmin, isLoading } = useRole();
  const users = useQuery(api.users.listUsers, isAdmin ? {} : "skip");
  const devices = useQuery(api.devices.listDevices, isAdmin ? {} : "skip");
  const setUserRole = useMutation(api.users.setUserRole);
  const unlockDevice = useMutation(api.devices.unlockDevice);
  const [showAddUser, setShowAddUser] = useState(false);

  const handleChange = async (userId: Id<"users">, role: Role) => {
    try {
      await setUserRole({ userId, role });
      toast.success("Peran diperbarui");
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Gagal memperbarui peran");
      }
    }
  };

  const handleUnlock = async (userId: Id<"users">, userName: string) => {
    try {
      await unlockDevice({ userId });
      toast.success(`Perangkat ${userName} berhasil dilepas`);
    } catch (error) {
      if (error instanceof ConvexError) {
        const { message } = error.data as { code: string; message: string };
        toast.error(message);
      } else {
        toast.error("Gagal melepas perangkat");
      }
    }
  };

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!isAdmin) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShieldCheck />
          </EmptyMedia>
          <EmptyTitle>Akses terbatas</EmptyTitle>
          <EmptyDescription>
            Hanya admin yang dapat mengelola peran pengguna.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div>
      <PageHeader
        title="Users Roles"
        description="Atur hak akses pengguna dan kelola kunci perangkat."
      />
      <Tabs defaultValue="peran" className="space-y-4">
        <TabsList>
          <TabsTrigger value="peran">Peran Pengguna</TabsTrigger>
          <TabsTrigger value="perangkat">Kunci Perangkat</TabsTrigger>
        </TabsList>

        <TabsContent value="peran">
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setShowAddUser(true)}>
              <UserPlus className="size-4 mr-2" />
              Tambah Pengguna
            </Button>
          </div>
          {users === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((u) => (
                <Card key={u._id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {u.name ?? "Tanpa nama"}
                      </div>
                      <div className="truncate text-sm text-muted-foreground">
                        {u.email ?? "-"}
                      </div>
                    </div>
                    <Select
                      value={u.role}
                      onValueChange={(value) =>
                        void handleChange(u._id, value as Role)
                      }
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            <span className="text-[10px] text-muted-foreground mr-1.5">
                              L{ROLE_LEVEL[r]}
                            </span>
                            {ROLE_LABELS[r]}
                            {DEVICE_LOCKED_ROLES.includes(r) && " 🔒"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="perangkat">
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <strong>Info:</strong> Danru, Wadanru, dan Anggota terkunci ke 1 perangkat.
            Login pertama = perangkat terdaftar. Lepas perangkat jika petugas ganti HP.
          </div>
          {devices === undefined ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : devices.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Smartphone />
                </EmptyMedia>
                <EmptyTitle>Belum ada perangkat terdaftar</EmptyTitle>
                <EmptyDescription>
                  Perangkat akan otomatis terdaftar saat Danru, Wadanru, atau Anggota login pertama kali.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="space-y-3">
              {devices.map((d) => (
                <Card key={d._id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{d.userName}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {ROLE_LABELS[d.userRole as Role] ?? d.userRole}
                        </Badge>
                      </div>
                      <div className="truncate text-xs text-muted-foreground mt-1">
                        {d.deviceInfo.split(" | ").slice(1).join(" | ") || d.deviceInfo}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Terdaftar: {new Date(d.registeredAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="cursor-pointer"
                      onClick={() => void handleUnlock(d.userId, d.userName)}
                    >
                      <Unlock className="mr-1.5 h-3.5 w-3.5" />
                      Lepas
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add User dialog */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Pengguna Baru</DialogTitle>
            <DialogDescription>
              Pengguna dikelola melalui portal Hercules Auth. Ikuti langkah berikut:
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              <span>Buka <strong>Hercules App Builder</strong> → tab <strong>Auth</strong> di sidebar kiri.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              <span>Pilih metode login yang diinginkan (email/password, Google, dll), lalu klik <strong>Manage Users</strong>.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
              <span>Klik <strong>"+ Add User"</strong>, masukkan nama, email, dan password, lalu simpan.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">4</span>
              <span>Setelah pengguna login pertama kali, nama mereka akan muncul di daftar ini dan Anda bisa mengatur perannya.</span>
            </li>
          </ol>
          <div className="rounded-lg border bg-secondary/40 p-3 text-xs text-muted-foreground">
            Setelah peran diatur, hubungkan akun ke data petugas di halaman <strong>Petugas → Ubah → Hubungkan Akun</strong> agar petugas bisa absen mandiri.
          </div>
          <Button className="w-full" onClick={() => setShowAddUser(false)}>
            Mengerti
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
