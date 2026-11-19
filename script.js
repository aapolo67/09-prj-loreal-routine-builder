/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineButton = document.getElementById("generateRoutine");
const userInput = document.getElementById("userInput");

/* Cloudflare Worker URL — the worker safely holds the API key */
const workerUrl = "https://mute-forest-8bc8.aapolo.workers.dev/";

/* Keep every message so the AI can remember the conversation */
const messages = [
  {
    role: "system",
    content:
      "You are a L'Oréal skincare and beauty advisor. Give helpful, safe, and personalized product routine advice.",
  },
];

/* Keep track of products selected by the user */
let selectedProducts = [];
let allProducts = [];

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
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = allProducts.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
});

/* Add or remove a product when its card is clicked */
productsContainer.addEventListener("click", async (e) => {
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
});

/* Remove a selected product using its remove button */
selectedProductsList.addEventListener("click", (e) => {
  const removeButton = e.target.closest("[data-remove-id]");
  if (!removeButton) return;

  const productId = Number(removeButton.dataset.removeId);
  selectedProducts = selectedProducts.filter((item) => item.id !== productId);
  displaySelectedProducts();

  if (categoryFilter.value) {
    displayProducts(
      allProducts.filter((item) => item.category === categoryFilter.value)
    );
  }
});

/* Send messages to the Cloudflare Worker and display the reply */
async function sendToWorker() {
  chatWindow.innerHTML = "Thinking...";

  try {
    const response = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`Worker request failed with status ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;

    /* Save the assistant reply for future follow-up questions */
    messages.push({ role: "assistant", content: reply });
    chatWindow.innerHTML = reply.replace(/\n/g, "<br>");
  } catch (error) {
    chatWindow.innerHTML = "Sorry, I could not connect to the routine advisor.";
  }
}

/* Generate a personalized routine from the selected products */
generateRoutineButton.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    chatWindow.innerHTML = "Please select at least one product first.";
    return;
  }

  const productDetails = selectedProducts
    .map(
      (product) =>
        `${product.brand} ${product.name}: ${product.description}`
    )
    .join("\n");

  const userMessage =
    `Build a personalized skincare or beauty routine using these selected products:\n${productDetails}\n` +
    "Explain the recommended order and include simple tips.";

  messages.push({ role: "user", content: userMessage });
  await sendToWorker();
});

/* Chat form submission handler */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userMessage = userInput.value.trim();
  if (!userMessage) return;

  /* Show the user's message and add it to the conversation */
  chatWindow.innerHTML = `<strong>You:</strong> ${userMessage}`;
  messages.push({ role: "user", content: userMessage });
  userInput.value = "";

  await sendToWorker();
});

/* Start with an empty selected-products message */
displaySelectedProducts();
