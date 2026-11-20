/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineButton = document.getElementById("generateRoutine");
const userInput = document.getElementById("userInput");
const productDialog = document.getElementById("productDialog");
const closeProductDialog = document.getElementById("closeProductDialog");
const dialogTitle = document.getElementById("dialogTitle");
const dialogBrand = document.getElementById("dialogBrand");
const dialogDescription = document.getElementById("dialogDescription");
const clearSelectedProducts = document.getElementById("clearSelectedProducts");
const productSearch = document.getElementById("productSearch");
const toggleProducts = document.getElementById("toggleProducts");
let openDetailsId = null;
const savedProductsKey = "loreal-selected-products";

/* Cloudflare Worker URL — the worker safely holds the API key */
const workerUrl = "https://mute-forest-8bc8.aapolo.workers.dev/";

/* Keep every message so the AI can remember the conversation */
const messages = [
  {
    role: "system",
    content:
      "You are a L'Oréal skincare and beauty advisor. Answer only questions about the generated routine or related topics such as skincare, haircare, makeup, fragrance, and beauty. Use the full conversation history to keep answers relevant. Use current real-time web information when the question asks about new products, prices, availability, ingredients, recalls, or other current facts. Include and cite reliable source links. Politely redirect unrelated questions to a beauty or routine topic.",
  },
];

/* Keep track of products selected by the user */
let selectedProducts = [];
let allProducts = [];
let productsAreHidden = false;

/* Save selected product IDs so selections survive a page reload */
function saveSelectedProducts() {
  const selectedIds = selectedProducts.map((product) => product.id);
  localStorage.setItem(savedProductsKey, JSON.stringify(selectedIds));
}

/* Restore selected products from the full product JSON file */
async function restoreSelectedProducts() {
  let savedIds = [];

  try {
    savedIds = JSON.parse(localStorage.getItem(savedProductsKey) || "[]");
  } catch (error) {
    localStorage.removeItem(savedProductsKey);
  }

  if (savedIds.length === 0) {
    displaySelectedProducts();
    return;
  }

  allProducts = await loadProducts();
  selectedProducts = allProducts.filter((product) =>
    savedIds.includes(product.id)
  );
  displaySelectedProducts();

  if (categoryFilter.value) {
    displayProducts(
      allProducts.filter((product) => product.category === categoryFilter.value)
    );
  }
}

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Apply both category and keyword filters to the product grid */
function normalizeSearchText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/* Count small spelling differences between two words */
function isCloseSpelling(word, target) {
  if (word.length < 3 || target.length < 3) return word === target;

  if (target.includes(word) || word.includes(target)) return true;

  let previousRow = Array.from(
    { length: target.length + 1 },
    (_, index) => index
  );

  for (let wordIndex = 1; wordIndex <= word.length; wordIndex++) {
    const currentRow = [wordIndex];

    for (let targetIndex = 1; targetIndex <= target.length; targetIndex++) {
      const insertCost = currentRow[targetIndex - 1] + 1;
      const deleteCost = previousRow[targetIndex] + 1;
      const replaceCost =
        previousRow[targetIndex - 1] +
        (word[wordIndex - 1] === target[targetIndex - 1] ? 0 : 1);

      currentRow[targetIndex] = Math.min(
        insertCost,
        deleteCost,
        replaceCost
      );
    }

    previousRow = currentRow;
  }

  const distance = previousRow[target.length];
  return distance <= (target.length <= 5 ? 1 : 2);
}

function filterProducts() {
  if (allProducts.length === 0) return;

  const selectedCategory = categoryFilter.value;
  const searchText = normalizeSearchText(productSearch.value);
  const searchWords = searchText.match(/[a-z0-9]+/g) || [];

  const matchingProducts = allProducts.filter((product) => {
    let matchesCategory = true;

    if (selectedCategory !== "all") {
      matchesCategory = product.category === selectedCategory;
    }

    const searchableText = normalizeSearchText(
      `${product.name} ${product.brand} ${product.category} ${product.description}`
    );
    const searchableWords = searchableText.match(/[a-z0-9]+/g) || [];

    let matchesSearch = searchText === "";
    if (!matchesSearch) {
      matchesSearch =
        searchableText.includes(searchText) ||
        searchWords.some((searchWord) =>
          searchableWords.some((productWord) =>
            isCloseSpelling(searchWord, productWord)
          )
        );
    }

    return matchesCategory && matchesSearch;
  });

  if (matchingProducts.length === 0) {
    productsContainer.innerHTML =
      '<div class="placeholder-message">No matching products found</div>';
    return;
  }

  displayProducts(matchingProducts);
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => `
    <div class="product-card ${selectedProducts.some((item) => item.id === product.id) ? "selected" : ""}"
         data-product-id="${product.id}">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
        <button type="button" class="details-btn" data-details-id="${product.id}">
          View Description
        </button>
      </div>
    </div>
  `
    )
    .join("");
}

/* Show the products the user has selected */
function displaySelectedProducts() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML = "<p>No products selected yet.</p>";
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
      <div class="selected-product">
        ${product.brand} - ${product.name}
        <button type="button" data-remove-id="${product.id}" aria-label="Remove ${product.name}">
          &times;
        </button>
      </div>
    `
    )
    .join("");
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  allProducts = await loadProducts();
  filterProducts();
});

/* Filter as soon as the user types in the search field */
productSearch.addEventListener("input", async () => {
  if (allProducts.length === 0) {
    allProducts = await loadProducts();
  }
  filterProducts();
});

/* Hide or show the product grid without changing filters or selections */
toggleProducts.addEventListener("click", () => {
  productsAreHidden = !productsAreHidden;
  productsContainer.classList.toggle("products-grid-hidden", productsAreHidden);
  toggleProducts.textContent = productsAreHidden
    ? "Show Products"
    : "Hide Products";
  toggleProducts.setAttribute("aria-expanded", String(!productsAreHidden));
});

/* Apply RTL automatically when the page language is an RTL language */
const rtlLanguages = ["ar", "he", "fa", "ur", "ps", "sd", "yi"];
function updateLayoutDirection() {
  const translatedRoot = document.documentElement;
  const translatedBody = document.body;
  const rootAndBodyClasses =
    `${translatedRoot.className} ${translatedBody.className}`.toLowerCase();
  const htmlLanguage = (translatedRoot.lang || "").toLowerCase();
  const browserLanguage = (navigator.language || "en").toLowerCase();

  /* Translation extensions use translated-rtl/translated-ltr classes */
  let textDirection = "ltr";
  if (
    rootAndBodyClasses.includes("translated-rtl") ||
    rtlLanguages.includes(htmlLanguage.split("-")[0]) ||
    rtlLanguages.includes(browserLanguage.split("-")[0])
  ) {
    textDirection = "rtl";
  }

  if (rootAndBodyClasses.includes("translated-ltr")) {
    textDirection = "ltr";
  }

  document.documentElement.dir = textDirection;
  translatedBody.classList.toggle("rtl-layout", textDirection === "rtl");
}

updateLayoutDirection();

/* Watch translation changes without changing or rewriting language attributes */
const languageObserver = new MutationObserver(updateLayoutDirection);
languageObserver.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["lang", "dir", "class"],
  childList: true,
  subtree: true,
});


/* Add or remove a product when its card is clicked */
productsContainer.addEventListener("click", async (e) => {
  /* Details buttons open the dialog instead of selecting the card */
  const detailsButton = e.target.closest("[data-details-id]");
  if (detailsButton) {
    const productId = Number(detailsButton.dataset.detailsId);

    /* Clicking the same button again closes the description */
    if (openDetailsId === productId && productDialog.open) {
      productDialog.close();
      openDetailsId = null;
      return;
    }

    const product = allProducts.find((item) => item.id === productId);

    if (product) {
      dialogTitle.textContent = product.name;
      dialogBrand.textContent = product.brand;
      dialogDescription.textContent = product.description;
      openDetailsId = productId;
      productDialog.show();

      /* Place a small popover above the card that was clicked */
      const cardRect = detailsButton.closest(".product-card").getBoundingClientRect();
      const dialogRect = productDialog.getBoundingClientRect();
      let left = cardRect.left + (cardRect.width - dialogRect.width) / 2;
      left = Math.max(16, Math.min(left, window.innerWidth - dialogRect.width - 16));

      let top = cardRect.top - dialogRect.height - 12;
      if (top < 16) {
        top = cardRect.bottom + 12;
      }

      productDialog.style.left = `${left}px`;
      productDialog.style.top = `${top}px`;
    }
    return;
  }

  const card = e.target.closest(".product-card");
  if (!card) return;

  const productId = Number(card.dataset.productId);
  if (allProducts.length === 0) {
    allProducts = await loadProducts();
  }

  const product = allProducts.find((item) => item.id === productId);
  const isAlreadySelected = selectedProducts.some((item) => item.id === productId);

  if (isAlreadySelected) {
    selectedProducts = selectedProducts.filter((item) => item.id !== productId);
  } else {
    selectedProducts.push(product);
  }

  displayProducts(
    allProducts.filter(
      (item) => item.category === categoryFilter.value
    )
  );
  displaySelectedProducts();
  saveSelectedProducts();
});

/* Close the product description dialog */
closeProductDialog.addEventListener("click", () => {
  productDialog.close();
  openDetailsId = null;
});

/* Reset the active product when Escape or the close button closes the popover */
productDialog.addEventListener("close", () => {
  openDetailsId = null;
});

/* Remove a selected product using its remove button */
selectedProductsList.addEventListener("click", (e) => {
  const removeButton = e.target.closest("[data-remove-id]");
  if (!removeButton) return;

  const productId = Number(removeButton.dataset.removeId);
  selectedProducts = selectedProducts.filter((item) => item.id !== productId);
  displaySelectedProducts();
  saveSelectedProducts();

  if (categoryFilter.value) {
    displayProducts(
      allProducts.filter((item) => item.category === categoryFilter.value)
    );
  }
});

/* Clear every saved selection at once */
clearSelectedProducts.addEventListener("click", () => {
  selectedProducts = [];
  saveSelectedProducts();
  displaySelectedProducts();

  if (categoryFilter.value) {
    displayProducts(
      allProducts.filter((item) => item.category === categoryFilter.value)
    );
  }
});

/* Send messages to the Cloudflare Worker and display the reply */
async function sendToWorker() {
  const thinkingMessage = addChatMessage("Thinking...", "assistant");

  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: messages,
        web_search_options: {
          search_context_size: "low",
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Worker request failed with status ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;

    /* Save the assistant reply for future follow-up questions */
    messages.push({ role: "assistant", content: reply });
    thinkingMessage.remove();
    addChatMessage(reply, "assistant", data.choices[0].message.annotations);
  } catch (error) {
    thinkingMessage.remove();
    addChatMessage("Sorry, I could not connect to the routine advisor.", "assistant");
  }
}

/* Add a chat bubble without allowing user text to create HTML elements */
function addChatMessage(content, sender, annotations = []) {
  const messageElement = document.createElement("div");
  messageElement.className = `chat-message ${sender}`;

  const textElement = document.createElement("div");
  textElement.textContent = content;
  messageElement.appendChild(textElement);

  /* Show web-search citation links returned by the API */
  const citationUrls = annotations
    .map((annotation) => annotation.url_citation)
    .filter((citation) => citation && citation.url);

  if (citationUrls.length > 0) {
    const sourcesElement = document.createElement("div");
    sourcesElement.className = "chat-sources";
    sourcesElement.innerHTML = "<strong>Sources</strong>";

    citationUrls.forEach((citation) => {
      const sourceLink = document.createElement("a");
      sourceLink.href = citation.url;
      sourceLink.target = "_blank";
      sourceLink.rel = "noopener noreferrer";
      sourceLink.textContent = citation.title || citation.url;
      sourcesElement.appendChild(document.createElement("br"));
      sourcesElement.appendChild(sourceLink);
    });

    messageElement.appendChild(sourcesElement);
  }

  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return messageElement;
}

/* Generate a personalized routine from the selected products */
generateRoutineButton.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    addChatMessage("Please select at least one product first.", "assistant");
    return;
  }

  /* Send only these selected-product fields to the Cloudflare Worker */
  const selectedProductData = selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));

  const productJson = JSON.stringify(selectedProductData, null, 2);
  const userMessage =
    "Build a personalized skincare or beauty routine using only these selected products:\n" +
    `\`\`\`json\n${productJson}\n\`\`\`\n` +
    "Explain the recommended order and include simple tips.";

  addChatMessage("Generate a routine for my selected products.", "user");
  messages.push({ role: "user", content: userMessage });
  await sendToWorker();
});

/* Chat form submission handler */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userMessage = userInput.value.trim();
  if (!userMessage) return;

  /* Show the user's message and add it to the conversation */
  addChatMessage(userMessage, "user");
  messages.push({ role: "user", content: userMessage });
  userInput.value = "";

  await sendToWorker();
});

/* Restore saved selections when the page loads */
restoreSelectedProducts();
