export function initDate({ store, onChange }) {
  const ukHolidays = [
    "2026-01-01",
    "2026-04-03",
    "2026-04-06",
    "2026-05-04",
    "2026-05-25",
    "2026-08-31",
    "2026-12-25",
    "2026-12-28",
    "2027-01-01",
    "2027-03-26",
    "2027-03-29",
    "2027-05-03",
    "2027-05-31",
    "2027-08-30",
    "2027-12-27",
    "2027-12-28",
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const defaultDate = new Date(today);
  defaultDate.setDate(today.getDate() + 2);

  const state = {
    selectedDate: new Date(defaultDate),
    hasInteracted: false,
    timeWindow: "8:00 AM - 2:00 PM",
    windowType: "6-hour",
    currentMonth: defaultDate.getMonth(),
    currentYear: defaultDate.getFullYear(),
  };

  const displayEl = document.getElementById("currentDateDisplay");
  const modalDisplayEl = document.getElementById("modalDateDisplay");
  const btnOpenCal = document.getElementById("btnOpenCalendar");
  const calWrapper = document.getElementById("calendarWrapper");
  const gridEl = document.getElementById("calendarGrid");
  const monthYearEl = document.getElementById("calMonthYear");
  const btnSaveDate = document.getElementById("btnSaveDate");

  function formatDateFriendly(date) {
    return date.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatYYYYMMDD(date) {
    const d = new Date(date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split("T")[0];
  }

  function updateDisplay() {
    const text = formatDateFriendly(state.selectedDate);
    displayEl.textContent = text;
    if (modalDisplayEl) modalDisplayEl.textContent = text;
  }

  function getBasePriceForCalendar() {
    const snap = store.getSnapshot();
    return snap.rawCollectionFee || 30;
  }

  function renderCalendar() {
    gridEl.innerHTML = "";
    const basePrice = getBasePriceForCalendar();

    const firstDay = new Date(state.currentYear, state.currentMonth, 1);
    const lastDay = new Date(state.currentYear, state.currentMonth + 1, 0);

    let startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;

    monthYearEl.textContent = firstDay.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });

    for (let i = 0; i < startDayOfWeek; i++) {
      const empty = document.createElement("div");
      gridEl.appendChild(empty);
    }

    const dayAfter = new Date(today);
    dayAfter.setDate(today.getDate() + 2);

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const cellDate = new Date(state.currentYear, state.currentMonth, day);
      const cellDateStr = formatYYYYMMDD(cellDate);
      const isPast = cellDate < today;

      const isWeekend = cellDate.getDay() === 0 || cellDate.getDay() === 6;
      const isHoliday = ukHolidays.includes(cellDateStr);
      const isUrgent =
        cellDate.getTime() >= today.getTime() &&
        cellDate.getTime() <= dayAfter.getTime();

      const hasSurge = isWeekend || isHoliday || isUrgent;
      let cellPrice = basePrice;
      if (hasSurge) cellPrice *= 1.15;

      const isSelected = cellDate.getTime() === state.selectedDate.getTime();

      const cell = document.createElement("div");
      cell.className = `cal-cell ${isPast ? "is-disabled" : ""} ${isSelected ? "is-selected" : ""} ${hasSurge ? "has-surge" : ""}`;

      cell.innerHTML = `
        <span class="cal-date">${day}</span>
        <span class="cal-price">£${Math.round(cellPrice)}</span>
      `;

      if (!isPast) {
        cell.addEventListener("click", () => {
          state.selectedDate = new Date(cellDate);
          state.hasInteracted = true;
          updateDisplay();
          renderCalendar();
          if (onChange) onChange();
        });
      }
      gridEl.appendChild(cell);
    }
  }

  btnOpenCal.addEventListener("click", () => {
    const isHidden = calWrapper.style.display === "none";
    calWrapper.style.display = isHidden ? "block" : "none";
    if (isHidden) {
      state.hasInteracted = true;
      renderCalendar();
    }
  });

  if (btnSaveDate) {
    btnSaveDate.addEventListener("click", () => {
      calWrapper.style.display = "none";
    });
  }

  document.getElementById("calPrevMonth").addEventListener("click", () => {
    state.currentMonth--;
    if (state.currentMonth < 0) {
      state.currentMonth = 11;
      state.currentYear--;
    }
    renderCalendar();
  });

  document.getElementById("calNextMonth").addEventListener("click", () => {
    state.currentMonth++;
    if (state.currentMonth > 11) {
      state.currentMonth = 0;
      state.currentYear++;
    }
    renderCalendar();
  });

  document.querySelectorAll('input[name="time_slot"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      state.timeWindow = e.target.value;
      state.windowType = e.target.getAttribute("data-type");
      if (onChange) onChange();
    });
  });

  // ФУНКЦИЯ СБРОСА ПАМЯТИ
  function resetDateModule() {
    state.selectedDate = new Date(defaultDate);
    state.hasInteracted = false;
    state.timeWindow = "8:00 AM - 2:00 PM";
    state.windowType = "6-hour";
    state.currentMonth = defaultDate.getMonth();
    state.currentYear = defaultDate.getFullYear();

    updateDisplay();
    renderCalendar();
  }

  updateDisplay();

  return {
    getData: () => ({
      date: state.selectedDate,
      hasInteracted: state.hasInteracted,
      timeWindow: state.timeWindow,
      windowType: state.windowType,
      isWeekend:
        state.selectedDate.getDay() === 0 || state.selectedDate.getDay() === 6,
      isHoliday: ukHolidays.includes(formatYYYYMMDD(state.selectedDate)),
      isUrgent:
        state.selectedDate.getTime() >= today.getTime() &&
        state.selectedDate.getTime() <= today.getTime() + 172800000,
    }),
    reRenderCalendar: renderCalendar,
    reset: resetDateModule, // Отдаем метод сброса наружу
  };
}
