function sendJson(response, status, data) {
  response.status(status).json(data);
}

function clean(value, maxLength) {
  return String(value ?? "").trim().replace(/[<>]/g, "").slice(0, maxLength);
}

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { ok: false, error: "method_not_allowed" });
  }

  const reservation = {
    name: clean(request.body?.name, 80),
    phone: clean(request.body?.phone, 40),
    date: clean(request.body?.date, 20),
    time: clean(request.body?.time, 10),
    guests: clean(request.body?.guests, 10)
  };
  const validPhone = /^[+\d][\d\s()\-]{6,}$/.test(reservation.phone);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(reservation.date);
  const validTime = /^\d{2}:\d{2}$/.test(reservation.time);
  if (!reservation.name || !validPhone || !validDate || !validTime || !reservation.guests) {
    return sendJson(response, 400, { ok: false, error: "validation_error" });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return sendJson(response, 503, { ok: false, error: "not_configured" });

  const message = [
    "Новая заявка · Rosso Rubino", "", `Имя: ${reservation.name}`,
    `Телефон: ${reservation.phone}`, `Дата: ${reservation.date}`,
    `Время: ${reservation.time}`, `Гостей: ${reservation.guests}`
  ].join("\n");

  try {
    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message })
    });
    if (!telegramResponse.ok) throw new Error("Telegram rejected the request");
    return sendJson(response, 200, { ok: true });
  } catch {
    return sendJson(response, 502, { ok: false, error: "delivery_failed" });
  }
}
