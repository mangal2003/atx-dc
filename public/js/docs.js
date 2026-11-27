document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".terminal-panel");
  const toast = document.getElementById("toast");

  function showToast(msg) {
    if (!toast) return;
    toast.innerText = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1500);
  }

  // Tab switching with horizontal scroll focus
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      panels.forEach((p) => p.classList.remove("active"));

      tab.classList.add("active");
      const targetPanel = document.getElementById(tab.dataset.target);
      if (targetPanel) {
        targetPanel.classList.add("active");
        tab.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
      }
    });
  });

  // Tap-to-copy syntax support for mobile touch
  document.querySelectorAll(".cmd-syntax").forEach((elem) => {
    elem.addEventListener("click", () => {
      const commandText = elem.innerText.split(" or ")[0].trim();
      navigator.clipboard
        .writeText(commandText)
        .then(() => {
          showToast(`Copied ${commandText}`);
        })
        .catch(() => {
          showToast("Copied to clipboard!");
        });
    });
  });
});
