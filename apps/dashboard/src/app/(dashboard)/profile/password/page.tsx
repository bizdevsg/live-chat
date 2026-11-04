"use client";

import { FormPage } from "@/components/layout/form-page";
import { ChangePasswordForm } from "@/components/profile/profile-forms";

export default function ChangePasswordPage() {
  return (
    <FormPage
      topbarTitle="Ganti Password"
      title="Ganti password"
      description="Gunakan password yang kuat dan belum pernah dipakai di tempat lain."
      backHref="/profile"
      backLabel="Kembali ke Profil"
    >
      <ChangePasswordForm />
    </FormPage>
  );
}
