const express = require("express");
const router = express.Router();
require("dotenv").config();

let transporter = null;
const emailConfigured = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

if (emailConfigured) {
  const nodemailer = require("nodemailer");
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  console.log("📧 خدمة الإيميل مفعّلة (SMTP مضبوط)");
} else {
  console.log("📧 خدمة الإيميل غير مفعّلة — SMTP غير مضبوط بـ .env (اختياري)");
}

// إرسال تفاصيل تذكرة NFT كاملة للإيميل: رقم التوكن + عنوان العقد + رابط Etherscan + صورة QR
router.post("/send-ticket", async (req, res) => {
  if (!emailConfigured) return res.status(503).json({ sent: false, reason: "SMTP غير مضبوط بالسيرفر" });

  const { to, tokenId, qrDataUrl, eventName } = req.body;
  if (!to || !tokenId || !qrDataUrl) {
    return res.status(400).json({ error: "to, tokenId, qrDataUrl كلها مطلوبة" });
  }

  try {
    const base64Data = qrDataUrl.replace(/^data:image\/png;base64,/, "");
    const contractAddress = process.env.TICKET_NFT_ADDRESS || "";
    const etherscanLink = contractAddress
      ? `https://sepolia.etherscan.io/token/${contractAddress}?a=${tokenId}`
      : "";

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to,
      subject: `تذكرتك NFT #${tokenId} — ${eventName || "فعاليتك"} 🎫`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; text-align: center; border: 2px dashed #b9ab86; border-radius: 12px; padding: 24px; background: #f2ead6; color: #171b24;">
          <h2 style="margin-top:0;">🎉 تم شراء تذكرتك بنجاح</h2>
          <p style="font-size:15px;">${eventName ? `<strong>${eventName}</strong><br/>` : ""}هذي تذكرتك الرقمية (NFT) — محفوظة على سلسلة Ethereum (Sepolia) باسمك، ولا يقدر أحد يزوّرها أو يكرّرها.</p>

          <table style="width:100%; text-align:right; font-family: monospace; font-size:13px; background:#e6dabd; border-radius:8px; padding:12px; margin:16px 0;">
            <tr><td style="padding:4px 0;"><strong>رقم التذكرة (Token ID):</strong></td><td>#${tokenId}</td></tr>
            <tr><td style="padding:4px 0;"><strong>عقد التذكرة (NFT Contract):</strong></td><td style="word-break:break-all;">${contractAddress}</td></tr>
            <tr><td style="padding:4px 0;"><strong>الشبكة:</strong></td><td>Ethereum Sepolia Testnet</td></tr>
          </table>

          ${etherscanLink ? `<p><a href="${etherscanLink}" style="color:#2f6b4f; font-weight:bold;">🔗 شاهد تذكرتك NFT مباشرة على Etherscan</a></p>` : ""}

          <p style="margin-top:20px;">اعرض رمز QR هذا عند بوابة الدخول:</p>
          <img src="cid:ticketqr" style="width:180px;height:180px;border-radius:8px;" />

          <p style="font-size:11px;color:#6b6350;margin-top:20px;">هذا الإيميل تأكيد فقط — التذكرة الحقيقية مخزّنة بمحفظتك (Wallet) على البلوك تشين، مو بهذا الإيميل.</p>
        </div>
      `,
      attachments: [
        { filename: `ticket-${tokenId}.png`, content: Buffer.from(base64Data, "base64"), cid: "ticketqr" },
      ],
    });

    res.json({ sent: true });
  } catch (err) {
    console.error("فشل إرسال الإيميل:", err.message);
    res.status(500).json({ sent: false, error: err.message });
  }
});

module.exports = router;
