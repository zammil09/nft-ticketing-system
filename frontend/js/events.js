async function fetchAllEvents() {
  try {
    const res = await fetch(`${BACKEND_URL}/events`);
    if (!res.ok) throw new Error("backend not ok");
    const rows = await res.json();
    return rows.map((r) => ({
      id: r.event_id, organizer: r.organizer_address, name: r.name, price: r.price_units,
      maxTickets: r.max_tickets, ticketsSold: r.tickets_sold, active: r.active,
      resaleCapPercent: r.resale_cap_percent,
    }));
  } catch (err) {
    return await fetchAllEventsFromChain();
  }
}

// ===== نسخة مُصلَحة: تقرأ الأحداث على دفعات (Chunks) بدل طلب واحد من بلوك صفر — يتجاوز حد 10,000 بلوك بالطلب الواحد =====
async function fetchAllEventsFromChain() {
  const logs = await getPastEventsChunked(contracts.registry, "EventCreated", { toBlock: "latest" });
  return Promise.all(logs.map(async (log) => {
    const eventId = log.returnValues.eventId;
    const live = await contracts.registry.methods.getEvent(eventId).call();
    return {
      id: eventId, organizer: live.organizer, name: live.name, price: live.price,
      maxTickets: live.maxTickets, ticketsSold: live.ticketsSold, active: live.active,
      resaleCapPercent: live.resaleCapPercent,
    };
  }));
}

async function renderBrowseEvents() {
  const container = document.getElementById("events-list");
  container.innerHTML = "جاري التحميل...";
  const events = await fetchAllEvents();
  const decimals = await contracts.usdc.methods.decimals().call();

  container.innerHTML = "";
  events.forEach((ev) => {
    const available = ev.active && Number(ev.ticketsSold) < Number(ev.maxTickets);
    const priceFormatted = (Number(ev.price) / 10 ** Number(decimals)).toFixed(2);
    const capLabel = Number(ev.resaleCapPercent) === 0 ? "ممنوع" : `حتى ${ev.resaleCapPercent}%`;

    const card = document.createElement("div");
    card.className = "ticket-stub";
    card.innerHTML = `
      <div class="stub-main">
        <p class="eyebrow">فعالية</p>
        <h3>${ev.name}</h3>
        <p class="meta">${ev.ticketsSold} / ${ev.maxTickets} تذكرة صادرة</p>
        <p class="meta mono">حد إعادة البيع: ${capLabel}</p>
        <span class="badge ${available ? "available" : "soldout"}">${available ? "متاح" : "مكتمل"}</span>
      </div>
      <div class="stub-perf"></div>
      <div class="stub-side">
        <p class="price">${priceFormatted}<span>USDC</span></p>
        <p class="admit">ADMIT ONE</p>
        <button ${available ? "" : "disabled"} data-buy="${ev.id}">شراء</button>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll("[data-buy]").forEach((btn) => btn.addEventListener("click", () => buyTicket(btn.dataset.buy, btn)));
  await refreshUsdcBalance();
}

document.getElementById("create-event-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("ev-name").value;
  const priceInput = document.getElementById("ev-price").value;
  const maxTickets = document.getElementById("ev-max").value;
  const resaleCap = document.getElementById("ev-resale-cap").value;

  showProcessing("جاري نشر فعاليتك", [
    { id: "prepare", label: "التحقق من البيانات" },
    { id: "send", label: "إرسال المعاملة للشبكة" },
    { id: "confirm", label: "تأكيد النشر على العقد الذكي" },
  ]);

  try {
    setStepStatus("prepare", "active");
    const decimals = await contracts.usdc.methods.decimals().call();
    const priceUnits = BigInt(Math.round(Number(priceInput) * 10 ** Number(decimals)));
    setStepStatus("prepare", "done");

    setStepStatus("send", "active");
    const receipt = await contracts.registry.methods
      .createEvent(name, priceUnits.toString(), maxTickets, resaleCap)
      .send({ from: currentAccount });
    setStepStatus("send", "done");

    setStepStatus("confirm", "active");
    const eventId = receipt.events?.EventCreated?.returnValues?.eventId ?? "—";
    setStepStatus("confirm", "done");

    showSuccess(`
      <p class="eyebrow">تم بنجاح</p>
      <h2>🎉 فعاليتك جاهزة الآن</h2>
      <div class="ticket-stub success-stub">
        <div class="stub-main">
          <h3>${name}</h3>
          <p class="meta">السعر: ${priceInput} USDC</p>
          <p class="meta">عدد التذاكر: ${maxTickets}</p>
          <p class="meta">حد إعادة البيع: ${resaleCap == 0 ? "ممنوع" : resaleCap + "%"}</p>
          <p class="meta mono">Event ID: #${eventId}</p>
        </div>
      </div>
      <div class="success-actions">
        <button data-nav="my-events">عرض بالـ Dashboard</button>
        <button class="secondary" data-nav="create-event">إنشاء فعالية أخرى</button>
      </div>
    `);
    document.getElementById("create-event-form").reset();
    document.getElementById("ev-resale-cap").value = 110;
  } catch (err) {
    console.error(err);
    showSuccess(`
      <p class="eyebrow">حدث خطأ</p>
      <h2>❌ فشل نشر الفعالية</h2>
      <p class="meta" style="max-width:400px;">${err.message || err}</p>
      <div class="success-actions"><button data-nav="create-event">حاول مرة أخرى</button></div>
    `);
  }
});

async function renderMyEvents() {
  const container = document.getElementById("my-events-list");
  container.innerHTML = "جاري التحميل...";
  const all = await fetchAllEvents();
  const mine = all.filter((ev) => ev.organizer.toLowerCase() === currentAccount.toLowerCase());
  const decimals = await contracts.usdc.methods.decimals().call();

  container.innerHTML = "";
  if (mine.length === 0) { container.innerHTML = "<p>لم تنشئ أي فعالية بعد.</p>"; return; }

  mine.forEach((ev) => {
    const priceFormatted = (Number(ev.price) / 10 ** Number(decimals)).toFixed(2);
    const revenue = (Number(ev.ticketsSold) * Number(priceFormatted)).toFixed(2);
    const row = document.createElement("div");
    row.className = "ledger-row";
    row.innerHTML = `
      <div>
        <h3>${ev.name}</h3>
        <p class="meta">السعر ${priceFormatted} USDC · المبيعات ${ev.ticketsSold}/${ev.maxTickets} · حد إعادة البيع ${ev.resaleCapPercent == 0 ? "ممنوع" : ev.resaleCapPercent + "%"}</p>
        <span class="badge ${ev.active ? "available" : "soldout"}">${ev.active ? "نشطة" : "متوقفة"}</span>
      </div>
      <p class="revenue">${revenue} USDC</p>
    `;
    container.appendChild(row);
  });
}

async function refreshUsdcBalance() {
  const bal = await contracts.usdc.methods.balanceOf(currentAccount).call();
  const decimals = await contracts.usdc.methods.decimals().call();
  document.getElementById("usdc-balance").textContent = `رصيدك: ${(Number(bal) / 10 ** Number(decimals)).toFixed(2)} mUSDC`;
}

document.getElementById("faucet-btn").addEventListener("click", async () => {
  try {
    const decimals = await contracts.usdc.methods.decimals().call();
    const amount = BigInt(100 * 10 ** Number(decimals));
    await contracts.usdc.methods.faucet(amount.toString()).send({ from: currentAccount });
    await refreshUsdcBalance();
  } catch (err) {
    alert("فشل الحصول على العملة التجريبية: " + (err.message || err));
  }
});
