# Magma Calculator — branded auth email templates

Paste these into **Supabase → Authentication → Emails → Templates**. Pick the template
on the left (Invite user / Confirm signup / Reset password), switch to the HTML/source
view, replace the contents with the block below, and Save.

Notes
- The logo is pulled from your live site: `https://calculator.magmacoatings.com/magma-logo.jpg`
  (make sure the domain is live + deployed; until then you can use
  `https://magma-calculator.vercel.app/magma-logo.jpg`).
- Supabase fills in `{{ .ConfirmationURL }}` automatically — leave it exactly as-is.
- Colours: Molten #F0851E · Basalt #211F1D · Ink #3A3833 · Stone #6F6B64 · Limestone #F6F4F0.
- To change the sender from "Supabase Auth <noreply@mail.app.supabase.io>" to
  "Magma Coatings", set up custom SMTP (separate step).

---

## 1) Invite user

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F4F0;padding:32px 0;font-family:Inter,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #EAE6E0;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:32px 40px 8px;" align="center">
        <img src="https://calculator.magmacoatings.com/magma-logo.jpg" alt="Magma Coatings" width="200" style="display:block;max-width:200px;height:auto;">
      </td></tr>
      <tr><td style="height:4px;background:#F0851E;margin:0 40px;"></td></tr>
      <tr><td style="padding:28px 40px 8px;">
        <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#211F1D;">You've been invited</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3A3833;">
          You've been added to the <strong>Magma Calculator</strong> — the materials estimator for installers.
          Click below to set your password and get started.
        </p>
        <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:9px;background:#F0851E;">
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:9px;">Accept invitation</a>
        </td></tr></table>
        <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#6F6B64;">
          If the button doesn't work, copy and paste this link:<br>
          <a href="{{ .ConfirmationURL }}" style="color:#B05E0E;word-break:break-all;">{{ .ConfirmationURL }}</a>
        </p>
      </td></tr>
      <tr><td style="padding:24px 40px 32px;border-top:1px solid #F2EFEA;margin-top:16px;">
        <p style="margin:16px 0 0;font-size:12px;color:#A8A39B;">Magma Coatings Ltd · Material Calculator</p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

---

## 2) Reset password

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F4F0;padding:32px 0;font-family:Inter,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #EAE6E0;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:32px 40px 8px;" align="center">
        <img src="https://calculator.magmacoatings.com/magma-logo.jpg" alt="Magma Coatings" width="200" style="display:block;max-width:200px;height:auto;">
      </td></tr>
      <tr><td style="height:4px;background:#F0851E;"></td></tr>
      <tr><td style="padding:28px 40px 8px;">
        <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#211F1D;">Reset your password</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3A3833;">
          We received a request to reset your Magma Calculator password. Click below to choose a new one.
          If you didn't request this, you can safely ignore this email.
        </p>
        <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:9px;background:#F0851E;">
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:9px;">Reset password</a>
        </td></tr></table>
        <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#6F6B64;">
          Or paste this link:<br>
          <a href="{{ .ConfirmationURL }}" style="color:#B05E0E;word-break:break-all;">{{ .ConfirmationURL }}</a>
        </p>
      </td></tr>
      <tr><td style="padding:24px 40px 32px;border-top:1px solid #F2EFEA;">
        <p style="margin:16px 0 0;font-size:12px;color:#A8A39B;">Magma Coatings Ltd · Material Calculator</p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

---

## 3) Confirm signup

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F4F0;padding:32px 0;font-family:Inter,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #EAE6E0;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:32px 40px 8px;" align="center">
        <img src="https://calculator.magmacoatings.com/magma-logo.jpg" alt="Magma Coatings" width="200" style="display:block;max-width:200px;height:auto;">
      </td></tr>
      <tr><td style="height:4px;background:#F0851E;"></td></tr>
      <tr><td style="padding:28px 40px 8px;">
        <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#211F1D;">Confirm your email</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#3A3833;">
          Please confirm your email address to activate your Magma Calculator account.
        </p>
        <table cellpadding="0" cellspacing="0"><tr><td style="border-radius:9px;background:#F0851E;">
          <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:9px;">Confirm email</a>
        </td></tr></table>
        <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#6F6B64;">
          Or paste this link:<br>
          <a href="{{ .ConfirmationURL }}" style="color:#B05E0E;word-break:break-all;">{{ .ConfirmationURL }}</a>
        </p>
      </td></tr>
      <tr><td style="padding:24px 40px 32px;border-top:1px solid #F2EFEA;">
        <p style="margin:16px 0 0;font-size:12px;color:#A8A39B;">Magma Coatings Ltd · Material Calculator</p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

---

## Removing "powered by Supabase" + custom sender (custom SMTP)

The Supabase footer and the `noreply@mail.app.supabase.io` sender only change once you
connect your own SMTP provider:

1. Sign up for an email provider with a free tier — **Resend** or **Brevo** are easy.
2. Verify your domain (add the DNS records they give you to magmacoatings.com).
3. Supabase → **Authentication → Emails → SMTP Settings** → enter the provider's host,
   port, username, password, and set the sender name **"Magma Coatings"** and
   from-address e.g. `noreply@magmacoatings.com`.
4. Save. Now emails send from your address, with no Supabase branding and proper
   deliverability/limits.
