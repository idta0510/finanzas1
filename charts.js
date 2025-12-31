function clear(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
}

function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
}

function fmtCLP(n) {
    const v = Number(n) || 0;
    return "$" + v.toLocaleString("es-CL");
}

export function drawBarLineSavings(canvas, labels, savings, accum) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    clear(ctx, W, H);

    // background
    ctx.fillStyle = "rgba(2,6,23,0.35)";
    roundRect(ctx, 0, 0, W, H, 12);
    ctx.fill();

    const pad = 44;
    const chartW = W - pad - 16;
    const chartH = H - pad - 18;
    const originX = pad;
    const originY = 12 + chartH;

    const maxAbs = Math.max(1, ...savings.map(v => Math.abs(v)), ...accum.map(v => Math.abs(v)));
    const yMax = maxAbs * 1.15;

    // axes
    ctx.strokeStyle = "rgba(148,163,184,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(originX, 12);
    ctx.lineTo(originX, originY);
    ctx.lineTo(originX + chartW, originY);
    ctx.stroke();

    // y labels (3 ticks)
    ctx.fillStyle = "rgba(156,163,175,0.9)";
    ctx.font = "12px system-ui";
    for (let i = 0; i <= 2; i++) {
        const t = i / 2;
        const val = yMax * (1 - t);
        const y = 12 + chartH * t;
        ctx.fillText(fmtCLP(val), 8, y + 4);

        ctx.strokeStyle = "rgba(148,163,184,0.10)";
        ctx.beginPath();
        ctx.moveTo(originX, y);
        ctx.lineTo(originX + chartW, y);
        ctx.stroke();
    }

    const n = labels.length;
    const gap = chartW / n;

    // bars (savings)
    for (let i = 0; i < n; i++) {
        const v = savings[i] || 0;
        const barH = Math.abs(v) / yMax * chartH;
        const x = originX + i * gap + gap * 0.18;
        const bw = gap * 0.64;
        const y = originY - barH;

        ctx.fillStyle = v >= 0 ? "rgba(34,197,94,0.75)" : "rgba(239,68,68,0.75)";
        roundRect(ctx, x, y, bw, barH, 8);
        ctx.fill();

        // month labels (every 2)
        if (i % 2 === 0) {
            ctx.fillStyle = "rgba(156,163,175,0.9)";
            ctx.font = "11px system-ui";
            ctx.fillText(labels[i], x, originY + 16);
        }
    }

    // line (accum)
    ctx.strokeStyle = "rgba(96,165,250,0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
        const v = accum[i] || 0;
        const x = originX + i * gap + gap * 0.5;
        const y = originY - (Math.abs(v) / yMax) * chartH; // acumulado lo llevamos a positivo (visual)
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // title hint
    ctx.fillStyle = "rgba(156,163,175,0.9)";
    ctx.font = "12px system-ui";
    ctx.fillText("Barras: ahorro mensual | Línea: acumulado (visual)", originX, 20);
}

export function drawTwoBars(canvas, labels, valuesA, valuesB, colorA, colorB, title) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    clear(ctx, W, H);

    ctx.fillStyle = "rgba(2,6,23,0.35)";
    roundRect(ctx, 0, 0, W, H, 12);
    ctx.fill();

    const pad = 44;
    const chartW = W - pad - 16;
    const chartH = H - pad - 18;
    const originX = pad;
    const originY = 12 + chartH;

    const maxV = Math.max(1, ...valuesA, ...valuesB) * 1.15;

    // axes
    ctx.strokeStyle = "rgba(148,163,184,0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(originX, 12);
    ctx.lineTo(originX, originY);
    ctx.lineTo(originX + chartW, originY);
    ctx.stroke();

    // y labels (3 ticks)
    ctx.fillStyle = "rgba(156,163,175,0.9)";
    ctx.font = "12px system-ui";
    for (let i = 0; i <= 2; i++) {
        const t = i / 2;
        const val = maxV * (1 - t);
        const y = 12 + chartH * t;
        ctx.fillText(fmtCLP(val), 8, y + 4);

        ctx.strokeStyle = "rgba(148,163,184,0.10)";
        ctx.beginPath();
        ctx.moveTo(originX, y);
        ctx.lineTo(originX + chartW, y);
        ctx.stroke();
    }

    const n = labels.length;
    const gap = chartW / n;

    // grouped bars
    for (let i = 0; i < n; i++) {
        const a = valuesA[i] || 0;
        const b = valuesB[i] || 0;
        const x0 = originX + i * gap + gap * 0.16;
        const bw = gap * 0.28;

        const ah = (a / maxV) * chartH;
        const bh = (b / maxV) * chartH;

        ctx.fillStyle = colorA;
        roundRect(ctx, x0, originY - ah, bw, ah, 6);
        ctx.fill();

        ctx.fillStyle = colorB;
        roundRect(ctx, x0 + bw + gap * 0.08, originY - bh, bw, bh, 6);
        ctx.fill();

        ctx.fillStyle = "rgba(156,163,175,0.9)";
        ctx.font = "11px system-ui";
        ctx.fillText(labels[i], x0, originY + 16);
    }

    ctx.fillStyle = "rgba(156,163,175,0.9)";
    ctx.font = "12px system-ui";
    ctx.fillText(title || "", originX, 20);
}

export function drawPieAndBars(canvas, items, title) {
    // items: [{label, value, color}]
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    clear(ctx, W, H);

    // BACKGROUND
    ctx.fillStyle = "rgba(2,6,23,0.35)";
    roundRect(ctx, 0, 0, W, H, 12);
    ctx.fill();

    // TITLE
    ctx.fillStyle = "rgba(156,163,175,0.92)";
    ctx.font = "14px system-ui";
    ctx.fillText(title || "", 18, 24);

    const total = items.reduce((s, it) => s + (Number(it.value) || 0), 0) || 1;

    // --- DONUT CONFIG ---
    // Moved center slightly right to 200 (was 150)
    // Increased radius to 135 (was 110)
    const cx = 200;
    const cy = H / 2 + 10;
    const rOuter = 135;
    const rInner = 85;

    let start = -Math.PI / 2;

    // Draw Donut Segments
    items.forEach(it => {
        const v = (Number(it.value) || 0);
        const ang = (v / total) * Math.PI * 2;

        ctx.beginPath();
        // Outer arc
        ctx.arc(cx, cy, rOuter, start, start + ang);
        // Inner arc (reverse direction to create hole properly if using fill rules, 
        // but here we just fill the segment and then can clear the center or draw arcs)
        // Simpler approach for flat colors: draw pie wedge, then later clear center? 
        // Better: draw thick strokes or complex paths. 
        // Let's use the standard "arc to arc" path for a TRUE ring.
        ctx.arc(cx, cy, rInner, start + ang, start, true);
        ctx.closePath();

        // Base color
        ctx.fillStyle = it.color;
        ctx.fill();

        // Gradient Overlay (Depth effect)
        // From inner radius (transparent) to outer radius (darker)
        // This gives a nice 3D "rounded" look to each color
        const grad = ctx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter);
        grad.addColorStop(0, "rgba(255,255,255, 0.05)"); // Slight highlight inside
        grad.addColorStop(1, "rgba(0,0,0, 0.25)");       // Shadow outside

        ctx.fillStyle = grad;
        ctx.fill();

        // Optional: small separator
        ctx.strokeStyle = "rgba(11, 18, 32, 1)";
        ctx.lineWidth = 4;
        ctx.stroke();

        start += ang;
    });

    // CENTER TEXT (Total)
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "bold 16px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Total", cx, cy - 10);

    ctx.fillStyle = "#9ca3af";
    ctx.font = "14px system-ui";
    ctx.fillText(fmtCLP(total), cx, cy + 12);

    // Reset text align
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";


    // --- BARS + LEGEND (Right side) ---
    // Adjusted LeftX to 400 (was 320) to make space for bigger chart
    const leftX = 400;
    const topY = 44; // Start a bit lower
    const barW = W - leftX - 18;
    const rowH = 26; // Height per row

    // Calculate max value for bar scaling
    const maxV = Math.max(1, ...items.map(i => i.value)) * 1.05;

    // Sorting by value descending
    const sortedItems = items.slice().sort((a, b) => b.value - a.value);

    // If too many items, limiting could be considered, but we have height 320.
    // 320 / 26 ~= 12 items max comfortably. 

    ctx.font = "12px system-ui";

    sortedItems.forEach((it, idx) => {
        const y = topY + idx * rowH;
        // Don't draw if it goes out of canvas
        if (y + rowH > H - 5) return;

        const w = (it.value / maxV) * barW;

        // Label
        ctx.fillStyle = "rgba(156,163,175,0.9)";
        ctx.fillText(it.label, leftX, y + 12);

        // Bar Background
        ctx.fillStyle = "rgba(148,163,184,0.18)";
        roundRect(ctx, leftX, y + 14, barW, 8, 4);
        ctx.fill();

        // Bar Value
        ctx.fillStyle = it.color;
        roundRect(ctx, leftX, y + 14, w, 8, 4);
        ctx.fill();

        // Amount Text (aligned right)
        ctx.fillStyle = "rgba(156,163,175,0.9)";
        const txtAmount = fmtCLP(it.value);
        const txtW = ctx.measureText(txtAmount).width;
        ctx.fillText(txtAmount, leftX + barW - txtW, y + 12);
    });
}

export function palette(i) {
    const colors = [
        "rgba(96,165,250,0.9)",
        "rgba(34,197,94,0.85)",
        "rgba(251,146,60,0.85)",
        "rgba(239,68,68,0.85)",
        "rgba(168,85,247,0.85)",
        "rgba(250,204,21,0.85)",
        "rgba(56,189,248,0.85)",
        "rgba(244,114,182,0.85)",
        "rgba(74,222,128,0.85)",
        "rgba(203,213,225,0.85)"
    ];
    return colors[i % colors.length];
}