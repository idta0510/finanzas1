/**
 * Muestra una notificación tipo "Toast".
 * @param {string} message - Texto a mostrar.
 * @param {string} [type="info"] - "success" | "error" | "warning" | "info"
 * @param {number} [duration=3000] - Tiempo en ms.
 */
export function showToast(message, type = "info", duration = 3000) {
    let container = document.getElementById("toastContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;

    // Icono según tipo
    let icon = "ℹ️";
    if (type === "success") icon = "✅";
    if (type === "error") icon = "❌";
    if (type === "warning") icon = "⚠️";

    toast.innerHTML = `
        <span class="toast__icon">${icon}</span>
        <span class="toast__msg">${message}</span>
    `;

    container.appendChild(toast);

    // Animación de entrada
    requestAnimationFrame(() => {
        toast.classList.add("toast--show");
    });

    // Remover después del tiempo
    setTimeout(() => {
        toast.classList.remove("toast--show");
        toast.addEventListener("transitionend", () => {
            toast.remove();
            if (container.children.length === 0) {
                container.remove();
            }
        });
    }, duration);
}
