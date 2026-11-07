async function openResellPrompt(tokenId, eventId) {
  showProcessing("جاري تجهيز عرض البيع", [{ id: "check", label: "التحقق من الحد الأقصى المسموح" }]);
  setStepStatus("check", "active");

  const maxResale = await contracts.registry.methods.getMaxResalePrice(eventId).call();
  const decimals = await contracts.usdc.methods.decimals().call();
  const maxFormatted = (Number(maxResale) / 10 ** Number(decimals)).toFixed(2);
  setStepStatus("check", "done");

  if (Number(maxResale) === 0) {
    showSuccess(`
      <p class="eyebrow">غير مسموح</p>
      <h2>🚫 إعادة البيع ممنوعة لهذه الفعالية</h2>
      <p class="meta">المنظّم حدد هذه الفعالية كـ "غير قابلة لإعادة البيع" وقت إنشائها.</p>
      <div class="success-actions"><button data-nav="my-tickets">رجوع لتذاكري</button></div>
    `);
    return;
  }

  showSuccess(`
    <p class="eyebrow">عرض التذكرة #${tokenId}</p>
    <h2>حدد سعر البيع</h2>
    <p class="meta">الحد الأقصى المسموح به من المنظّم: <strong>${maxFormatted} USDC</strong></p>
    <form id="resell-price-form" style="max-width:300px;margin:16px auto;">
      <label>السعر (USDC) <input type="number" id="resell-price-input" min="0" max="${maxFormatted}" step="0.01" required /></label>
      <button type="submit">نشر العرض على السلسلة</button>
    </form>
  `);

  document.getElementById("resell-price-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const priceInput = document.getElementById("resell-price-input").value;
    await listTicketForResale(tokenId, priceInput, decimals);
  });
}

async function listTicketForResale(tokenId, priceInput, decimals) {
  showProcessing("جاري نشر عرض إعادة البيع", [{ id: "list", label: "تسجيل العرض على العقد الذكي" }]);
  try {
    setStepStatus("list", "active");
    const priceUnits = BigInt(Math.round(Number(priceInput) * 10 ** Number(decimals)));
    await contracts.ticketNFT.methods.listForResale(tokenId, priceUnits.toString()).send({ from: currentAccount });
    setStepStatus("list", "done");

    showSuccess(`
      <p class="eyebrow">تم النشر</p>
      <h2>✅ تذكرتك معروضة الآن بسوق إعادة البيع</h2>
      <p class="meta">بسعر ${priceInput} USDC</p>
      <div class="success-actions">
        <button data-nav="marketplace">عرض سوق إعادة البيع</button>
        <button class="secondary" data-nav="my-tickets">رجوع لتذاكري</button>
      </div>
    `);
  } catch (err) {
    console.error(err);
    showSuccess(`
      <p class="eyebrow">فشل النشر</p>
      <h2>❌ العقد الذكي رفض العرض</h2>
      <p class="meta" style="max-width:400px;">${err.message || err}</p>
      <div class="success-actions"><button data-nav="my-tickets">رجوع لتذاكري</button></div>
    `);
  }
}

// ===== نسخة مُصلَحة: تقرأ الأحداث على دفعات (Chunks) بدل طلب واحد من بلوك صفر — يتجاوز حد 10,000 بلوك بالطلب الواحد =====
async function renderResaleMarketplace() {
  const container = document.getElementById("resale-list");
  container.innerHTML = "جاري التحميل...";

  const logs = await getPastEventsChunked(contracts.ticketNFT, "TicketListedForResale", { toBlock: "latest" });
  const decimals = await contracts.usdc.methods.decimals().call();

  const listings = [];
  for (const log of logs) {
    const tokenId = log.returnValues.tokenId;
    const currentPrice = await contracts.ticketNFT.methods.resaleListingPrice(tokenId).call();
    if (Number(currentPrice) === 0) continue; // اتباعت أو اتلغت

    const owner = await contracts.ticketNFT.methods.ownerOf(tokenId).call();
    const info = await contracts.ticketNFT.methods.ticketInfo(tokenId).call();
    const ev = await contracts.registry.methods.getEvent(info.eventId).call();

    listings.push({ tokenId, price: currentPrice, seller: owner, eventName: ev.name });
  }

  container.innerHTML = "";
  if (listings.length === 0) { container.innerHTML = "<p>لا توجد تذاكر معروضة لإعادة البيع حالياً.</p>"; return; }

  listings.forEach((l) => {
    const priceFormatted = (Number(l.price) / 10 ** Number(decimals)).toFixed(2);
    const isMine = l.seller.toLowerCase() === currentAccount.toLowerCase();
    const card = document.createElement("div");
    card.className = "ticket-stub";
    card.innerHTML = `
      <div class="stub-main">
        <p class="eyebrow">إعادة بيع</p>
        <h3>${l.eventName}</h3>
        <p class="meta mono">#${l.tokenId}</p>
        <p class="meta mono">البائع: ${l.seller.slice(0, 6)}...${l.seller.slice(-4)}</p>
      </div>
      <div class="stub-perf"></div>
      <div class="stub-side">
        <p class="price">${priceFormatted}<span>USDC</span></p>
        <button ${isMine ? "disabled" : ""} data-resale-buy="${l.tokenId}">${isMine ? "تذكرتك" : "شراء"}</button>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll("[data-resale-buy]").forEach((btn) => btn.addEventListener("click", () => buyResaleTicket(btn.dataset.resaleBuy)));
}

async function buyResaleTicket(tokenId) {
  showProcessing("جاري شراء التذكرة من السوق الثانوي", [
    { id: "approve", label: "الموافقة على سحب المبلغ" },
    { id: "buy", label: "تنفيذ الشراء (العقد يتحقق من الحد الأقصى تلقائياً)" },
  ]);

  try {
    const price = await contracts.ticketNFT.methods.resaleListingPrice(tokenId).call();

    setStepStatus("approve", "active");
    await contracts.usdc.methods.approve(CONTRACT_ADDRESSES.MARKETPLACE, price).send({ from: currentAccount });
    setStepStatus("approve", "done");

    setStepStatus("buy", "active");
    const receipt = await contracts.marketplace.methods.buyResaleTicket(tokenId).send({ from: currentAccount });
    setStepStatus("buy", "done");

    showSuccess(`
      <p class="eyebrow">تم الشراء</p>
      <h2>🎉 اشتريت التذكرة من السوق الثانوي</h2>
      <p class="meta mono">#${tokenId}</p>
      <p style="font-size:11px;word-break:break-all;color:#8a8370;">Tx: ${receipt.transactionHash}</p>
      <div class="success-actions">
        <button data-nav="my-tickets">عرض تذاكري</button>
        <button class="secondary" data-nav="marketplace">رجوع للسوق</button>
      </div>
    `);
  } catch (err) {
    console.error(err);
    showSuccess(`
      <p class="eyebrow">فشلت العملية</p>
      <h2>❌ لم يكتمل الشراء</h2>
      <p class="meta" style="max-width:400px;">${err.message || err}</p>
      <div class="success-actions"><button data-nav="marketplace">رجوع للسوق</button></div>
    `);
  }
}
