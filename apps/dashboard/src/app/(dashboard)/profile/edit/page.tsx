"use client";

import { FormPage } from "@/components/layout/form-page";
import { EditProfileForm } from "@/components/profile/profile-forms";
import { useAuthStore } from "@/lib/auth-store";

export default function EditProfilePage() {
  const user = useAuthStore((s) => s.user);

  return (
    <FormPage
      topbarTitle="Edit Profil"
      title="Edit profil"
      description="Ubah nama dan foto profil Anda."
      backHref="/profile"
      backLabel="Kembali ke Profil"
    >
      {user ? <EditProfileForm user={user} /> : null}
    </FormPage>
  );
}
