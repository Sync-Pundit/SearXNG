// SPDX-License-Identifier: AGPL-3.0-or-later

import { listen } from "../toolkit.ts";
import { getElement } from "../util/getElement.ts";

const searchForm: HTMLFormElement = getElement<HTMLFormElement>("search");
const searchInput: HTMLInputElement = getElement<HTMLInputElement>("q");
const searchReset: HTMLButtonElement = getElement<HTMLButtonElement>("clear_search");

const isMobile: boolean = window.matchMedia("(max-width: 50em)").matches;
const isResultsPage: boolean = document.querySelector("main")?.id === "main_results";

const categoryButtons: HTMLButtonElement[] = Array.from(
  document.querySelectorAll<HTMLButtonElement>("#categories_container button.category")
);

const colorPicker = document.querySelector<HTMLInputElement>("#color-answer-picker");
const colorValue = document.querySelector<HTMLOutputElement>("#color-answer-value");
const colorCopy = document.querySelector<HTMLButtonElement>("#color-answer-copy");
const colorStatus = document.querySelector<HTMLElement>("#color-answer-status");

if (colorPicker && colorValue && colorCopy && colorStatus) {
  listen("input", colorPicker, () => {
    colorValue.value = colorPicker.value;
    colorStatus.textContent = "";
  });
  listen("click", colorCopy, async () => {
    try {
      await navigator.clipboard.writeText(colorPicker.value);
      colorStatus.textContent = colorCopy.dataset.copiedText || "Copied";
    } catch {
      colorStatus.textContent = colorCopy.dataset.selectText || "Select the value to copy";
    }
  });
}

// focus search input on large screens
if (!(isMobile || isResultsPage)) {
  searchInput.focus();
}

// On mobile, move cursor to the end of the input on focus
if (isMobile) {
  listen("focus", searchInput, () => {
    // Defer cursor move until the next frame to prevent a visual jump
    requestAnimationFrame(() => {
      const end = searchInput.value.length;
      searchInput.setSelectionRange(end, end);
      searchInput.scrollLeft = searchInput.scrollWidth;
    });
  });
}

listen("click", searchReset, (event: MouseEvent) => {
  event.preventDefault();
  searchInput.value = "";
  searchInput.focus();
});

for (const button of categoryButtons) {
  listen("click", button, (event: MouseEvent) => {
    if (event.shiftKey) {
      event.preventDefault();
      button.classList.toggle("selected");
      return;
    }

    // deselect all other categories
    for (const categoryButton of categoryButtons) {
      categoryButton.classList.toggle("selected", categoryButton === button);
    }
  });
}

if (document.querySelector("div.search_filters")) {
  const safesearchElement = document.getElementById("safesearch");
  if (safesearchElement) {
    listen("change", safesearchElement, () => searchForm.submit());
  }

  const timeRangeElement = document.getElementById("time_range");
  if (timeRangeElement) {
    listen("change", timeRangeElement, () => searchForm.submit());
  }

  const languageElement = document.getElementById("language");
  if (languageElement) {
    listen("change", languageElement, () => searchForm.submit());
  }
}

// override searchForm submit event
listen("submit", searchForm, (event: Event) => {
  event.preventDefault();

  if (categoryButtons.length > 0) {
    const searchCategories = getElement<HTMLInputElement>("selected-categories");
    searchCategories.value = categoryButtons
      .filter((button) => button.classList.contains("selected"))
      .map((button) => button.name.replace("category_", ""))
      .join(",");
  }

  searchForm.submit();
});
