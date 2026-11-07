
// ===== دالة مساعدة لرسم QR (تعمل مع مكتبة qrcode التي توفر toCanvas) =====
function drawQR(canvas, text, width, onDone) {
    const value = String(text);
 
    // 1) مكتبة qrcode (npm): تدعم toCanvas
    if (typeof QRCode !== "undefined" && typeof QRCode.toCanvas === "function") {
        QRCode.toCanvas(canvas, value, { width, margin: 1 }, (err) => {
            if (onDone) onDone(err || null);
        });
        return;
    }
 
    // 2) مكتبة qrcodejs: constructor يرسم داخل عنصر div ثم ننسخ النتيجة إلى canvas
    if (typeof QRCode === "function") {
        let temp = null;
 
        try {
            temp = document.createElement("div");
            temp.style.display = "none";
            document.body.appendChild(temp);
 
            new QRCode(temp, {
                text: value,
                width,
                height: width,
                correctLevel: QRCode.CorrectLevel
                    ? QRCode.CorrectLevel.M
                    : undefined
            });
 
            const srcCanvas = temp.querySelector("canvas");
 
            if (!srcCanvas) {
                throw new Error("qrcodejs لم تنشئ canvas");
            }
 
            canvas.width = srcCanvas.width;
            canvas.height = srcCanvas.height;
            canvas.getContext("2d").drawImage(srcCanvas, 0, 0);
 
            if (onDone) onDone(null);
        } catch (err) {
            if (onDone) onDone(err);
        } finally {
            if (temp) temp.remove();
        }
        return;
    }
 
    // 3) لا توجد مكتبة
    console.error("لا توجد مكتبة QR محمّلة.");
    if (onDone) onDone(new Error("QR library missing"));
}
 
 
async function buyTicket(eventId, btn) {
    const eventCard = btn?.closest(".ticket-stub");
    const eventName =
        eventCard?.querySelector("h3")?.textContent?.trim() || "الفعالية";
 
    if (!currentAccount) {
        alert("يرجى ربط محفظتك أولاً.");
        return;
    }
 
    if (!contracts?.registry || !contracts?.usdc || !contracts?.marketplace) {
        alert("العقود غير جاهزة. أعد تحميل الصفحة وتأكد من ربط المحفظة.");
        return;
    }
 
    if (btn) btn.disabled = true;
 
    showProcessing("جاري إتمام عملية الشراء", [
        { id: "approve", label: "الموافقة على سحب المبلغ (Approve)" },
        { id: "buy", label: "تنفيذ الشراء وسك التذكرة" }
    ]);
 
    let purchaseSucceeded = false;
    let receipt = null;
 
    try {
        // 1. جلب بيانات الفعالية من العقد
        const ev = await contracts.registry.methods
            .getEvent(eventId)
            .call();
 
        // 2. الموافقة على استخدام USDC
        setStepStatus("approve", "active");
 
        await contracts.usdc.methods
            .approve(CONTRACT_ADDRESSES.MARKETPLACE, ev.price)
            .send({ from: currentAccount });
 
        setStepStatus("approve", "done");
 
        // 3. شراء التذكرة
        setStepStatus("buy", "active");
 
        receipt = await contracts.marketplace.methods
            .buyTicket(eventId)
            .send({ from: currentAccount });
 
        purchaseSucceeded = true;
        setStepStatus("buy", "done");
 
    } catch (err) {
        // هذا الـ catch خاص بالمعاملة فقط
        console.error("خطأ أثناء شراء التذكرة:", err);
 
        showSuccess(`
            <p class="eyebrow">حدث خطأ</p>
            <h2>❌ تعذّر إتمام عملية الشراء</h2>
            <p class="meta" style="max-width:400px;overflow-wrap:anywhere;">
                ${escapeTicketText(err?.message || String(err))}
            </p>
            <div class="success-actions">
                <button data-nav="browse">الرجوع للفعاليات</button>
            </div>
        `);
 
        if (btn) btn.disabled = false;
        return;
    }
 
    // ===== من هنا المعاملة نجحت؛ أي خطأ في العرض لا يعني فشل الشراء =====
    try {
        // 4. استخراج رقم التذكرة من حدث العقد
        let tokenId =
            receipt.events?.TicketPurchased?.returnValues?.tokenId;
 
        // بعض إصدارات Web3 قد تعيد الأحداث بصيغة مختلفة
        if (tokenId === undefined || tokenId === null) {
            const logs = receipt.events
                ? Object.values(receipt.events)
                : [];
 
            for (const event of logs) {
                if (event?.event === "TicketPurchased") {
                    tokenId = event.returnValues?.tokenId;
                    break;
                }
            }
        }
 
        if (tokenId === undefined || tokenId === null) {
            console.error(
                "تم تنفيذ المعاملة، لكن لم يمكن استخراج tokenId.",
                receipt
            );
 
            showSuccess(`
                <p class="eyebrow">تم تنفيذ المعاملة</p>
                <h2>تم الشراء، لكن تعذر استخراج رقم التذكرة</h2>
                <p class="meta">
                    لا تعاود الشراء قبل التحقق من محفظتك وسجل المعاملات.
                </p>
                <p style="word-break:break-all;">
                    Tx: ${escapeTicketText(receipt.transactionHash)}
                </p>
                <div class="success-actions">
                    <button data-nav="my-tickets">عرض تذاكري</button>
                    <button class="secondary" data-nav="browse">
                        العودة للفعاليات
                    </button>
                </div>
            `);
 
            return;
        }
 
        // 5. عرض صفحة النجاح
        showPurchaseSuccessPage(
            String(tokenId),
            eventName,
            receipt.transactionHash
        );
 
    } catch (renderErr) {
        console.error("الشراء نجح لكن فشل عرض صفحة النجاح:", renderErr);
 
        showSuccess(`
            <p class="eyebrow">تم الشراء</p>
            <h2>✅ تم تنفيذ الشراء</h2>
            <p class="meta">
                حدث خطأ أثناء عرض التذكرة. تحقق من "تذاكري" قبل محاولة الشراء مرة أخرى.
            </p>
            <p style="word-break:break-all;">
                Tx: ${escapeTicketText(receipt?.transactionHash || "")}
            </p>
            <div class="success-actions">
                <button data-nav="my-tickets">عرض تذاكري</button>
                <button class="secondary" data-nav="browse">
                    العودة للفعاليات
                </button>
            </div>
        `);
    } finally {
        if (btn) btn.disabled = false;
    }
}
 
 
// حماية النصوص عند عرض رسالة الخطأ داخل HTML
function escapeTicketText(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}
 
 
// عرض صفحة نجاح الشراء وإنشاء QR
function showPurchaseSuccessPage(tokenId, eventName, txHash) {
    showSuccess(`
        <p class="eyebrow">تم الشراء بنجاح</p>
        <h2>🎉 تذكرتك جاهزة</h2>
 
        <div class="ticket-stub success-stub">
            <div class="stub-main">
                <h3>${escapeTicketText(eventName)}</h3>
                <p class="meta mono">#${escapeTicketText(tokenId)}</p>
                <span class="badge available">صالحة</span>
            </div>
 
            <div class="stub-perf"></div>
 
            <div class="stub-side">
                <canvas
                    id="success-qr"
                    class="qr-canvas qr-large"
                ></canvas>
                <p id="qr-status" class="meta"></p>
            </div>
        </div>
 
        <div class="success-actions">
            <button id="download-qr-btn">⬇️ تنزيل QR كصورة</button>
 
            <button class="secondary" data-nav="my-tickets">
                عرض كل تذاكري
            </button>
 
            <button class="secondary" data-nav="browse">
                تصفح فعاليات أخرى
            </button>
        </div>
 
        <p id="email-status" class="email-status"></p>
 
        <p style="font-size:11px;word-break:break-all;color:#8a8370;margin-top:10px;">
            Tx: ${escapeTicketText(txHash)}
        </p>
    `);
 
    const qrCanvas = document.getElementById("success-qr");
    const qrStatus = document.getElementById("qr-status");
    const downloadButton = document.getElementById("download-qr-btn");
 
    // رسم QR دون أن يؤثر أي خطأ في المكتبة على نتيجة الشراء
    if (qrCanvas) {
        drawQR(qrCanvas, tokenId, 250, (err) => {
            if (!qrStatus) return;
 
            if (err) {
                console.error("فشل إنشاء QR:", err);
                qrStatus.textContent =
                    "تعذر إنشاء QR. أعد تحميل الصفحة.";
            } else {
                qrStatus.textContent = "رمز التذكرة";
            }
        });
    }
 
    if (downloadButton) {
        downloadButton.addEventListener("click", () => {
            const canvas = document.getElementById("success-qr");
 
            if (
                !canvas ||
                canvas.width === 0 ||
                canvas.height === 0
            ) {
                alert("رمز QR غير جاهز للتنزيل بعد.");
                return;
            }
 
            downloadCanvasAsImage(canvas, `ticket-${tokenId}.png`);
        });
    }
 
    // إرسال البريد وظيفة منفصلة؛ فشلها لا يلغي الشراء
    sendTicketEmail(tokenId, eventName).catch((err) => {
        console.warn("تعذر إرسال التذكرة بالبريد:", err);
    });
}
 
 
// إرسال تفاصيل التذكرة بالبريد الإلكتروني
async function sendTicketEmail(tokenId, eventName) {
    const statusEl = document.getElementById("email-status");
 
    try {
        const userRes = await fetch(
            `${BACKEND_URL}/users/${currentAccount}`
        );
 
        if (!userRes.ok) {
            if (statusEl) {
                statusEl.textContent =
                    "لم نتمكن من التحقق من البريد الإلكتروني.";
            }
            return;
        }
 
        const user = await userRes.json();
 
        if (!user.email) {
            if (statusEl) {
                statusEl.textContent =
                    "أضف بريدك الإلكتروني إلى حسابك لاستلام التذكرة.";
            }
            return;
        }
 
        const canvas = document.getElementById("success-qr");
        let qrDataUrl = null;
 
        if (
            canvas &&
            canvas.width > 0 &&
            canvas.height > 0
        ) {
            qrDataUrl = canvas.toDataURL("image/png");
        }
 
        const res = await fetch(
            `${BACKEND_URL}/email/send-ticket`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    to: user.email,
                    tokenId: String(tokenId),
                    qrDataUrl,
                    eventName
                })
            }
        );
 
        if (statusEl) {
            statusEl.textContent = res.ok
                ? `📧 أُرسلت تفاصيل التذكرة إلى ${user.email}`
                : "تم الشراء، لكن تعذر إرسال البريد الإلكتروني.";
        }
 
    } catch (err) {
        console.warn("تعذر إرسال الإيميل:", err);
 
        if (statusEl) {
            statusEl.textContent =
                "تم الشراء، لكن تعذر إرسال البريد الإلكتروني.";
        }
    }
}
 
 async function fetchMyTicketsFromChain() {
    if (!currentAccount) {
        throw new Error("يرجى ربط المحفظة أولاً.");
    }

    if (!web3 || !contracts?.marketplace) {
        throw new Error("عقد Marketplace أو Web3 غير جاهز.");
    }

    const me = String(currentAccount).toLowerCase();
    const START_BLOCK = 12084450;
    const CHUNK_SIZE = 9;

    const latestBlock = Number(await web3.eth.getBlockNumber());

    if (!Number.isSafeInteger(latestBlock) || latestBlock < START_BLOCK) {
        return [];
    }

    const events = [];

    for (
        let fromBlock = START_BLOCK;
        fromBlock <= latestBlock;
        fromBlock += CHUNK_SIZE
    ) {
        const toBlock = Math.min(
            fromBlock + CHUNK_SIZE - 1,
            latestBlock
        );

        console.log(
            `البحث عن التذاكر من الكتلة ${fromBlock} إلى ${toBlock}`
        );

        const batch = await contracts.marketplace.getPastEvents(
            "TicketPurchased",
            { fromBlock, toBlock }
        );

        events.push(...batch);
    }

    const tickets = [];
    const seenTokenIds = new Set();
    const eventNames = {};

    for (const event of events) {
        const rv = event.returnValues || {};

        const buyer =
            rv.buyer ??
            rv.owner ??
            rv.user ??
            rv.account ??
            rv.purchaser;

        if (
            typeof buyer !== "string" ||
            buyer.toLowerCase() !== me
        ) {
            continue;
        }

        const tokenId = rv.tokenId;
        const eventId = rv.eventId ?? rv.eventID ?? rv.id;

        if (tokenId === undefined || tokenId === null) {
            console.warn(
                "حدث شراء بلا tokenId؛ تحقق من أسماء حقول الحدث.",
                rv
            );
            continue;
        }

        const tokenKey = String(tokenId);

        if (seenTokenIds.has(tokenKey)) {
            continue;
        }

        let eventName = "فعالية";

        if (eventId !== undefined && eventId !== null) {
            const key = String(eventId);

            if (!(key in eventNames)) {
                try {
                    const data = await contracts.registry.methods
                        .getEvent(eventId)
                        .call();

                    eventNames[key] =
                        data.name ||
                        data.eventName ||
                        data[0] ||
                        "فعالية";
                } catch (err) {
                    console.warn(
                        "تعذر تحميل اسم الفعالية:",
                        eventId,
                        err
                    );
                    eventNames[key] = "فعالية";
                }
            }

            eventName = eventNames[key];
        }

        seenTokenIds.add(tokenKey);

        tickets.push({
            tokenId: tokenKey,
            eventId:
                eventId !== undefined && eventId !== null
                    ? String(eventId)
                    : "",
            eventName,
            checkedIn: false
        });
    }

    console.log(
        `تم العثور على ${tickets.length} تذكرة للمحفظة ${me}`
    );

    return tickets;
}
// عرض تذاكر المستخدم
async function renderMyTickets() {
    const container = document.getElementById("tickets-list");
 
    if (!container) {
        console.error("لم يتم العثور على العنصر tickets-list.");
        return;
    }
 
    container.innerHTML = "<p>جاري تحميل تذاكرك...</p>";
 
    try {
        let tickets = null;

if (typeof fetchMyTicketsFromBackend === "function") {
    try {
        tickets = await fetchMyTicketsFromBackend();
    } catch (err) {
        console.warn("تعذّر تحميل التذاكر من Backend:", err);
    }
}

if (!tickets) {
    tickets = await fetchMyTicketsFromChain();
}
 
        container.innerHTML = "";
 
        if (!tickets || tickets.length === 0) {
            container.innerHTML = "<p>لا تملك أي تذاكر بعد.</p>";
            return;
        }
 
        tickets.forEach((ticket) => {
            const card = document.createElement("div");
            card.className = "ticket-stub";
 
            const main = document.createElement("div");
            main.className = "stub-main";
 
            const eyebrow = document.createElement("p");
            eyebrow.className = "eyebrow";
            eyebrow.textContent = "تذكرة";
 
            const title = document.createElement("h3");
            title.textContent = ticket.eventName || "فعالية";
 
            const token = document.createElement("p");
            token.className = "meta mono";
            token.textContent = `#${ticket.tokenId}`;
 
            main.append(eyebrow, title, token);
 
            const perforation = document.createElement("div");
            perforation.className = "stub-perf";
 
            const side = document.createElement("div");
            side.className = "stub-side";
 
            if (ticket.checkedIn) {
                const stamp = document.createElement("p");
                stamp.className = "stamp used";
                stamp.textContent = "مستخدمة";
                side.appendChild(stamp);
            } else {
                const canvas = document.createElement("canvas");
                canvas.className = "qr-canvas";
                canvas.dataset.token = String(ticket.tokenId);
 
                const stamp = document.createElement("p");
                stamp.className = "stamp valid";
                stamp.textContent = "صالحة";
 
                const downloadButton = document.createElement("button");
                downloadButton.className = "download-btn";
                downloadButton.dataset.token = String(ticket.tokenId);
                downloadButton.textContent = "⬇️ تنزيل";
 
                downloadButton.addEventListener("click", () => {
                    if (canvas.width > 0 && canvas.height > 0) {
                        downloadCanvasAsImage(
                            canvas,
                            `ticket-${ticket.tokenId}.png`
                        );
                    } else {
                        alert("رمز QR غير جاهز للتنزيل.");
                    }
                });
 
                const resellButton = document.createElement("button");
                resellButton.className = "resell-btn secondary";
                resellButton.dataset.token = String(ticket.tokenId);
                resellButton.dataset.event = String(ticket.eventId);
                resellButton.textContent = "🔁 بيعها";
 
                resellButton.addEventListener("click", () => {
                    openResellPrompt(
                        ticket.tokenId,
                        ticket.eventId
                    );
                });
 
                side.append(
                    canvas,
                    stamp,
                    downloadButton,
                    resellButton
                );
 
                drawQR(canvas, ticket.tokenId, 84, (err) => {
                    if (err) {
                        console.error(
                            "فشل إنشاء QR للتذكرة:",
                            ticket.tokenId,
                            err
                        );
 
                        const warning = document.createElement("p");
                        warning.className = "meta";
                        warning.textContent = "تعذر رسم QR.";
                        side.appendChild(warning);
                    }
                });
            }
 
            card.append(main, perforation, side);
            container.appendChild(card);
        });
 
    } catch (err) {
        console.error("فشل تحميل التذاكر:", err);
        container.innerHTML =
            "<p>تعذر تحميل التذاكر. تحقق من اتصال الخادم والمحفظة ثم حاول مجددًا.</p>";
    }
}

