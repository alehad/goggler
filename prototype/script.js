const navItems = document.querySelectorAll(".nav-item");
const tabs = document.querySelectorAll(".tab");

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    const nextTab = item.getAttribute("data-tab");
    navItems.forEach((navItem) => navItem.classList.remove("active"));
    tabs.forEach((tab) => tab.classList.remove("active"));
    item.classList.add("active");
    document.getElementById(nextTab)?.classList.add("active");
  });
});

