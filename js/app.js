import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, updatePassword } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, increment, onSnapshot, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
// ==========================================
// VIEW TOGGLING LOGIC
// ==========================================
const loginView = document.getElementById('login-view');
const posView = document.getElementById('pos-view');
const inventoryView = document.getElementById('inventory-view');
const reportsView = document.getElementById('reports-view');
const fiadosView = document.getElementById('fiados-view');

const navLogoutContainer = document.getElementById('nav-logout-container');
const navPos = document.getElementById('nav-pos');
const navInventory = document.getElementById('nav-inventory');
const navReports = document.getElementById('nav-reports');
const navFiados = document.getElementById('nav-fiados');
const navLogin = document.getElementById('nav-login');

function showView(viewToShow) {
    // Hide all views first
    loginView.classList.add('d-none');
    posView.classList.add('d-none');
    inventoryView.classList.add('d-none');
    reportsView.classList.add('d-none');
    fiadosView.classList.add('d-none');
    
    // Show the requested view
    viewToShow.classList.remove('d-none');
}

// ==========================================
// APERTURA DE CAJA & ESTADO GLOBAL
// ==========================================
let globalCajaClosed = false;
let globalCajaDocId = null;

const aperturaModalEl = document.getElementById('apertura-caja-modal');
let aperturaModal;
if (aperturaModalEl) {
    aperturaModal = new bootstrap.Modal(aperturaModalEl, { backdrop: 'static', keyboard: false });
}

async function checkAperturaCaja() {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const q = query(collection(db, 'caja_diaria'), where('dateString', '==', todayStr));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
        globalCajaClosed = false;
        globalCajaDocId = null;
        if (aperturaModal) aperturaModal.show();
    } else {
        const docSnap = snapshot.docs[0];
        globalCajaDocId = docSnap.id;
        globalCajaClosed = docSnap.data().closed || false;
    }
}

const btnSubmitApertura = document.getElementById('btn-submit-apertura');
if (btnSubmitApertura) {
    btnSubmitApertura.addEventListener('click', async () => {
        const montoInput = document.getElementById('apertura-monto');
        const monto = parseFloat(montoInput.value);
        
        if (isNaN(monto) || monto < 0) {
            showToast('Por favor ingrese un monto válido.', 'error');
            return;
        }
        
        btnSubmitApertura.disabled = true;
        btnSubmitApertura.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Guardando...';
        
        try {
            const todayStr = new Date().toLocaleDateString('en-CA');
            const newDocRef = await addDoc(collection(db, 'caja_diaria'), {
                monto: monto,
                dateString: todayStr,
                timestamp: serverTimestamp(),
                user: auth.currentUser ? auth.currentUser.email : 'Desconocido',
                closed: false
            });
            globalCajaDocId = newDocRef.id;
            globalCajaClosed = false;
            
            if (aperturaModal) aperturaModal.hide();
            showToast(`Caja abierta con $${monto.toFixed(2)}`);
            if (reportDatePicker && reportDatePicker.value === todayStr) {
                loadDailySalesTable(todayStr);
            }
        } catch (err) {
            console.error("Error al abrir caja:", err);
            showToast('Error al registrar apertura', 'error');
        } finally {
            btnSubmitApertura.disabled = false;
            btnSubmitApertura.innerHTML = 'Confirmar Fondo';
        }
    });
}

// Listen to Firebase Auth state changes
onAuthStateChanged(auth, async (user) => {
    const authElements = document.querySelectorAll('.auth-only');
    
    if (user) {
        // User is logged in
        authElements.forEach(el => el.classList.remove('d-none'));
        navLogin.parentElement.classList.add('d-none'); // Hide login nav link
        
        // Security: Mandatory Password Check
        try {
            const userDoc = await getDoc(doc(db, 'usuarios', user.email));
            if (userDoc.exists() && userDoc.data().requiereCambioClave === true) {
                const cambioModal = new bootstrap.Modal(document.getElementById('cambio-clave-modal'));
                cambioModal.show();
                
                const form = document.getElementById('cambio-clave-form');
                form.onsubmit = async (e) => {
                    e.preventDefault();
                    const btnSubmit = document.getElementById('btn-submit-password');
                    const pass1 = document.getElementById('new-password').value;
                    const pass2 = document.getElementById('confirm-new-password').value;
                    
                    if (pass1 !== pass2) {
                        showToast("Las contraseñas no coinciden", "error");
                        return;
                    }
                    if (pass1.length < 6) {
                        showToast("La contraseña debe tener al menos 6 caracteres", "error");
                        return;
                    }
                    
                    btnSubmit.disabled = true;
                    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Actualizando...';
                    
                    try {
                        await updatePassword(auth.currentUser, pass1);
                        await updateDoc(doc(db, 'usuarios', user.email), { requiereCambioClave: false });
                        cambioModal.hide();
                        showToast("Contraseña actualizada exitosamente", "success");
                        
                        showView(posView);
                        fetchProducts();
                        checkAperturaCaja();
                    } catch (error) {
                        console.error("Error al actualizar contraseña:", error);
                        showToast("Error al actualizar contraseña", "error");
                    } finally {
                        btnSubmit.disabled = false;
                        btnSubmit.innerHTML = '<i class="fa-solid fa-key me-2"></i>Actualizar Contraseña';
                    }
                };
                return; // Stop initialization flow here
            }
        } catch (err) {
            console.error("Error checking password requirement:", err);
        }
        
        showView(posView);
        
        // Fetch products only when user logs in
        fetchProducts();
        checkAperturaCaja();
    } else {
        // User is logged out
        showView(loginView);
        authElements.forEach(el => el.classList.add('d-none'));
        navLogin.parentElement.classList.remove('d-none'); // Show login nav link
    }
});

// Navbar Event Listeners
navPos.addEventListener('click', (e) => { 
    e.preventDefault(); 
    if(auth.currentUser) showView(posView); 
});
navInventory.addEventListener('click', (e) => { 
    e.preventDefault(); 
    if(auth.currentUser) showView(inventoryView); 
});
navReports.addEventListener('click', (e) => { 
    e.preventDefault(); 
    if(auth.currentUser) {
        showView(reportsView); 
        
        // Auto-load today's sales if date picker is empty
        const datePicker = document.getElementById('report-date-picker');
        if (datePicker && typeof loadDailySalesTable === 'function') {
            if (!datePicker.value) {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                datePicker.value = `${yyyy}-${mm}-${dd}`;
            }
            loadDailySalesTable(datePicker.value);
        }
    }
});
navFiados.addEventListener('click', (e) => { 
    e.preventDefault(); 
    if(auth.currentUser) {
        showView(fiadosView); 
        fetchFiados();
    }
});
navLogin.addEventListener('click', (e) => { 
    e.preventDefault(); 
    if(!auth.currentUser) showView(loginView); 
});

// ==========================================
// FIRESTORE & INVENTORY LOGIC
// ==========================================
const productsCollectionRef = collection(db, 'productos');
let globalProducts = []; // To store fetched products

const inventoryTableBody = document.querySelector('#inventory-table tbody');
const btnAddProduct = document.getElementById('btn-add-product');

// Fetch products from Firestore (Real-time)
function fetchProducts() {
    onSnapshot(productsCollectionRef, (snapshot) => {
        globalProducts = snapshot.docs.map(document => ({
            id: document.id,
            ...document.data()
        }));
        
        renderPOSProducts();
        renderInventoryTable();
    }, (error) => {
        console.error("Error fetching products:", error);
    });
}

// Render Inventory Table
function renderInventoryTable() {
    if (!inventoryTableBody) return;
    inventoryTableBody.innerHTML = '';
    
    if (globalProducts.length === 0) {
        inventoryTableBody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No hay productos en inventario</td></tr>';
        return;
    }

    globalProducts.forEach(product => {
        const tr = document.createElement('tr');
        
        // Use imageUrl if available, otherwise fallback to an icon
        const imageContent = product.imageUrl && product.imageUrl.trim() !== ''
            ? `<img src="${product.imageUrl}" alt="${product.name}" onerror="this.onerror=null;this.outerHTML='<i class=\\'fa-solid fa-image text-muted fa-2x\\'></i>';" style="width: 50px; height: 50px; object-fit: cover; border-radius: 5px;">` 
            : `<i class="fa-solid fa-image text-muted fa-2x"></i>`;

        const stockQty = product.stock !== undefined ? parseInt(product.stock, 10) : 0;
        const isOutOfStock = stockQty <= 0;
        const isLowStock = stockQty > 0 && stockQty < 10;
        
        let stockBadgeHTML = '<span class="badge bg-success stock-badge">Disponible</span>';
        if (isOutOfStock) {
            stockBadgeHTML = '<span class="badge bg-danger stock-badge">Agotado</span>';
        } else if (isLowStock) {
            stockBadgeHTML = '<span class="badge bg-warning text-dark stock-badge">¡Poco Stock!</span>';
        }

        tr.innerHTML = `
            <td>${imageContent}</td>
            <td class="fw-bold">${product.name}</td>
            <td><span class="badge bg-secondary">${product.category || 'N/A'}</span></td>
            <td class="text-success fw-bold">$${parseFloat(product.price).toFixed(2)}</td>
            <td>
                <div>Stock: ${stockQty}</div>
                ${stockBadgeHTML}
            </td>
            <td class="text-end">
                <button class="btn btn-sm btn-outline-primary me-2 btn-edit" data-id="${product.id}">
                    <i class="fa-solid fa-pen"></i> Editar
                </button>
                <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${product.id}">
                    <i class="fa-solid fa-trash"></i> Eliminar
                </button>
            </td>
        `;
        
        // Bind Actions
        tr.querySelector('.btn-edit').addEventListener('click', () => editProduct(product));
        tr.querySelector('.btn-delete').addEventListener('click', () => deleteProduct(product.id));
        
        inventoryTableBody.appendChild(tr);
    });
}

// ==========================================
// MODAL LOGIC (ADD / EDIT)
// ==========================================
const modalElement = document.getElementById('productModal');
let productModal;

// Form Elements
const modalForm = document.getElementById('product-form');
const modalIdInput = document.getElementById('modal-product-id');
const modalNameInput = document.getElementById('modal-product-name');
const modalPriceInput = document.getElementById('modal-product-price');
const modalCategoryInput = document.getElementById('modal-product-category');
const modalImageInput = document.getElementById('modal-product-image');
const modalStockInput = document.getElementById('modal-product-stock');
const btnSaveProduct = document.getElementById('btn-save-product');

if (modalElement) {
    productModal = new bootstrap.Modal(modalElement);
}

// CREATE Product Button
if (btnAddProduct) {
    btnAddProduct.addEventListener('click', () => {
        modalForm.reset();
        modalIdInput.value = '';
        productModal.show();
    });
}

// UPDATE Product Button (Called from Inventory Table)
function editProduct(product) {
    modalIdInput.value = product.id;
    modalNameInput.value = product.name;
    modalPriceInput.value = parseFloat(product.price).toFixed(2);
    modalCategoryInput.value = product.category || '';
    modalImageInput.value = product.imageUrl || '';
    modalStockInput.value = product.stock !== undefined ? product.stock : 0;
    
    productModal.show();
}

// SAVE Product (Handles both Create and Update)
if (btnSaveProduct) {
    btnSaveProduct.addEventListener('click', async () => {
        const id = modalIdInput.value;
        const name = modalNameInput.value.trim();
        const priceStr = modalPriceInput.value;
        const category = modalCategoryInput.value.trim();
        const imageUrl = modalImageInput.value.trim();
        let stock = parseInt(modalStockInput.value, 10);
        if (isNaN(stock) || stock < 0) stock = 0;

        if (!name || !priceStr) {
            alert("Por favor completa los campos obligatorios (Nombre y Precio).");
            return;
        }

        const price = parseFloat(priceStr);
        if (isNaN(price)) {
            alert("Precio inválido.");
            return;
        }

        btnSaveProduct.disabled = true;
        btnSaveProduct.textContent = 'Guardando...';

        try {
            if (id) {
                // Update Existing
                const docRef = doc(db, 'productos', id);
                await updateDoc(docRef, {
                    name: name,
                    price: price,
                    category: category,
                    imageUrl: imageUrl,
                    stock: stock
                });
            } else {
                // Add New
                await addDoc(productsCollectionRef, {
                    name: name,
                    price: price,
                    category: category,
                    imageUrl: imageUrl,
                    stock: stock
                });
            }
            
            productModal.hide();
            fetchProducts(); // Refresh tables
        } catch (error) {
            console.error("Error al guardar el producto:", error);
            alert("Hubo un error al guardar el producto.");
        } finally {
            btnSaveProduct.disabled = false;
            btnSaveProduct.textContent = 'Guardar';
        }
    });
}

// DELETE Product
async function deleteProduct(productId) {
    if (!confirm("¿Está seguro de que desea eliminar este producto del inventario?")) return;
    
    try {
        const docRef = doc(db, 'productos', productId);
        await deleteDoc(docRef);
        
        // Remove from cart if it was deleted from inventory
        removeFromCart(productId);
        
        alert("Producto eliminado.");
        fetchProducts(); // Refresh lists
    } catch (error) {
        console.error("Error al eliminar el producto:", error);
        alert("Hubo un error al eliminar el producto.");
    }
}

// ==========================================
// BAJAS (SPOILED INVENTORY) LOGIC
// ==========================================
const btnShowBajas = document.getElementById('btn-show-bajas');
const bajasModalEl = document.getElementById('bajas-modal');
const bajasForm = document.getElementById('bajas-form');
let bajasModal;
if (bajasModalEl) {
    bajasModal = new bootstrap.Modal(bajasModalEl);
}

if (btnShowBajas) {
    btnShowBajas.addEventListener('click', () => {
        const selectProd = document.getElementById('baja-producto');
        selectProd.innerHTML = '<option value="" disabled selected>Seleccione el producto...</option>';
        
        // Populate select with current inventory
        globalProducts.forEach(prod => {
            const opt = document.createElement('option');
            opt.value = prod.id;
            opt.textContent = `${prod.name} (Stock actual: ${prod.stock || 0})`;
            selectProd.appendChild(opt);
        });
        
        bajasForm.reset();
        bajasModal.show();
    });
}

if (bajasForm) {
    bajasForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btnSubmitBaja = document.getElementById('btn-submit-baja');
        const originalText = btnSubmitBaja.innerHTML;
        
        const productId = document.getElementById('baja-producto').value;
        const cantidad = parseInt(document.getElementById('baja-cantidad').value, 10);
        const motivo = document.getElementById('baja-motivo').value;
        
        const prodMatch = globalProducts.find(p => p.id === productId);
        if (!prodMatch) return;
        
        if (cantidad > (prodMatch.stock || 0)) {
            showToast("La cantidad a retirar es mayor al stock disponible", "error");
            return;
        }
        
        btnSubmitBaja.disabled = true;
        btnSubmitBaja.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i>Procesando...';
        
        try {
            // 1. Add record to bajas collection
            await addDoc(collection(db, 'bajas'), {
                productId: prodMatch.id,
                productName: prodMatch.name,
                cantidad: cantidad,
                motivo: motivo,
                date: serverTimestamp(),
                registradoPor: auth.currentUser ? auth.currentUser.email : 'Desconocido'
            });
            
            // 2. Deduct stock from productos
            const productRef = doc(db, 'productos', prodMatch.id);
            await updateDoc(productRef, {
                stock: increment(-cantidad)
            });
            
            bajasModal.hide();
            showToast("Baja registrada correctamente", "success");
            
            // fetchProducts() is already triggered by onSnapshot automatically
            
        } catch (error) {
            console.error("Error al registrar baja:", error);
            showToast("Hubo un error al registrar la baja", "error");
        } finally {
            btnSubmitBaja.disabled = false;
            btnSubmitBaja.innerHTML = originalText;
        }
    });
}

// ==========================================
// POS AND SHOPPING CART LOGIC
// ==========================================
const productsGrid = document.getElementById('products-grid');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalElement = document.getElementById('cart-total');
const btnClearCart = document.getElementById('btn-clear-cart');
const btnCheckout = document.getElementById('btn-checkout');

let cart = [];

function renderPOSProducts() {
    if (!productsGrid) return;
    productsGrid.innerHTML = '';
    
    if (globalProducts.length === 0) {
        productsGrid.innerHTML = '<div class="col-12 text-center text-muted py-5"><p>No hay productos disponibles.</p></div>';
        return;
    }

    globalProducts.forEach(product => {
        const stockQty = product.stock !== undefined ? parseInt(product.stock, 10) : 0;
        const isOutOfStock = stockQty <= 0;
        
        const col = document.createElement('div');
        col.className = 'col-12 col-sm-6 col-md-4 mb-3';
        
        const imageContent = product.imageUrl && product.imageUrl.trim() !== ''
            ? `<img src="${product.imageUrl}" alt="${product.name}" onerror="this.onerror=null;this.outerHTML='<i class=\\'fa-solid fa-bread-slice fa-3x text-muted\\'></i>';">` 
            : `<i class="fa-solid fa-bread-slice fa-3x text-muted"></i>`;

        let cardClass = 'product-card';
        let stockBadge = `<small class="text-muted d-block mt-1">Stock: ${stockQty}</small>`;
        
        if (isOutOfStock) {
            cardClass += ' opacity-50';
            stockBadge += `<br><span class="badge bg-danger mt-1">Agotado</span>`;
        } else if (stockQty > 0 && stockQty < 10) {
            cardClass += ' low-stock-alert';
            stockBadge += `<br><span class="badge bg-warning text-dark mt-1">¡Poco Stock!</span>`;
        }

        col.innerHTML = `
            <div class="${cardClass}" data-id="${product.id}">
                <div class="product-img-container">
                    ${imageContent}
                </div>
                <div class="product-details">
                    <div class="product-title">${product.name}</div>
                    <div class="product-price">$${parseFloat(product.price).toFixed(2)}</div>
                    ${stockBadge}
                </div>
            </div>
        `;
        
        // Add click listener to add item to cart
        col.querySelector('.product-card').addEventListener('click', () => {
            if (isOutOfStock) return;
            addToCart(product);
        });
        productsGrid.appendChild(col);
    });
}

function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    if (existingItem) {
        existingItem.quantity += 1; // Increase quantity if already in cart
    } else {
        cart.push({ ...product, quantity: 1 }); // Add new item
    }
    updateCartUI();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartUI();
}

function changeQuantity(productId, delta) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        let newQty = item.quantity + delta;
        if (newQty > 500) {
            newQty = 500; // Limit max quantity to 500
        }
        item.quantity = newQty;
        
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            updateCartUI();
        }
    }
}

function updateCartUI() {
    if (!cartItemsContainer) return;
    cartItemsContainer.innerHTML = '';
    let total = 0;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<li class="list-group-item text-center text-muted py-5">El carrito está vacío</li>';
        if (cartTotalElement) cartTotalElement.textContent = '$0.00';
        return;
    }

    cart.forEach(item => {
        const price = parseFloat(item.price);
        const subtotal = price * item.quantity;
        total += subtotal;

        const li = document.createElement('li');
        li.className = 'list-group-item cart-item';
        li.innerHTML = `
            <div class="cart-item-details">
                <div class="cart-item-title">${item.name}</div>
                <div class="cart-item-price">$${price.toFixed(2)} x ${item.quantity} = <strong class="text-dark">$${subtotal.toFixed(2)}</strong></div>
            </div>
            <div class="cart-item-actions">
                <button class="btn btn-sm btn-outline-secondary qty-btn btn-minus" data-id="${item.id}">-</button>
                <input type="number" class="form-control form-control-sm qty-input text-center mx-1" style="width: 60px;" value="${item.quantity}" min="1" max="500" data-id="${item.id}">
                <button class="btn btn-sm btn-outline-secondary qty-btn btn-plus" data-id="${item.id}">+</button>
                <button class="btn btn-sm btn-danger qty-btn btn-remove" data-id="${item.id}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        
        // Bind event listeners for quantity controls
        li.querySelector('.btn-minus').addEventListener('click', () => changeQuantity(item.id, -1));
        li.querySelector('.btn-plus').addEventListener('click', () => changeQuantity(item.id, 1));
        li.querySelector('.btn-remove').addEventListener('click', () => removeFromCart(item.id));
        
        // Manual quantity input listener
        const qtyInput = li.querySelector('.qty-input');
        qtyInput.addEventListener('change', (e) => {
            let newQty = parseInt(e.target.value, 10);
            
            // Validation fallback
            if (isNaN(newQty) || newQty < 1) {
                newQty = 1;
            } else if (newQty > 500) {
                newQty = 500;
            }
            
            // Update cart array and refresh UI
            const cartItem = cart.find(c => c.id === item.id);
            if (cartItem) {
                cartItem.quantity = newQty;
                updateCartUI();
            }
        });
        
        cartItemsContainer.appendChild(li);
    });

    if (cartTotalElement) {
        cartTotalElement.textContent = '$' + total.toFixed(2);
    }
}

// Clear Cart Action
if (btnClearCart) {
    btnClearCart.addEventListener('click', () => {
        cart = [];
        updateCartUI();
    });
}

// ==========================================
// PAYMENT & CHECKOUT LOGIC
// ==========================================
const paymentModalElement = document.getElementById('payment-modal');
const paymentTotalDisplay = document.getElementById('payment-total-display');
const paymentReceivedInput = document.getElementById('payment-received');
const paymentChangeDisplay = document.getElementById('payment-change-display');
const btnConfirmPayment = document.getElementById('btn-confirm-payment');
let paymentModal;

if (paymentModalElement) {
    paymentModal = new bootstrap.Modal(paymentModalElement);
}

const checkoutModalElement = document.getElementById('checkout-success-modal');
const checkoutFinalTotal = document.getElementById('checkout-final-total');
let checkoutSuccessModal;

if (checkoutModalElement) {
    checkoutSuccessModal = new bootstrap.Modal(checkoutModalElement);
}

// Payment Action (Opens Payment Modal)
if (btnCheckout) {
    btnCheckout.addEventListener('click', () => {
        if (cart.length === 0) {
            alert("El carrito está vacío. Agregue productos antes de cobrar.");
            return;
        }
        
        // Reset payment fields
        paymentReceivedInput.value = '';
        paymentChangeDisplay.textContent = '$0.00';
        paymentChangeDisplay.className = 'alert alert-secondary fs-4 fw-bold text-center mb-0';
        if (btnConfirmPayment) btnConfirmPayment.disabled = true;
        
        // Display total
        if (paymentTotalDisplay && cartTotalElement) {
            paymentTotalDisplay.textContent = cartTotalElement.textContent;
        }
        
        // Show payment modal
        if (paymentModal) {
            paymentModal.show();
        }
    });
}

// Calculate Change Dynamic Listener
if (paymentReceivedInput) {
    paymentReceivedInput.addEventListener('input', (e) => {
        const received = parseFloat(e.target.value);
        const numericTotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
        
        if (isNaN(received) || received < numericTotal) {
            paymentChangeDisplay.textContent = "Monto insuficiente";
            paymentChangeDisplay.className = 'alert alert-danger fs-5 fw-bold text-center mb-0';
            if (btnConfirmPayment) btnConfirmPayment.disabled = true;
        } else {
            const change = received - numericTotal;
            paymentChangeDisplay.textContent = '$' + change.toFixed(2);
            paymentChangeDisplay.className = 'alert alert-success fs-4 fw-bold text-center mb-0';
            if (btnConfirmPayment) btnConfirmPayment.disabled = false;
        }
    });
}

// Confirm Payment & Save to Firestore
if (btnConfirmPayment) {
    btnConfirmPayment.addEventListener('click', async () => {
        if (globalCajaClosed) {
            showToast("La caja del día ya ha sido cerrada", "error");
            return;
        }
        
        btnConfirmPayment.disabled = true;
        const originalText = btnConfirmPayment.innerHTML;
        btnConfirmPayment.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Procesando...';

        try {
            const numericTotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
            
            // IP Logging for Audit
            let ipOrigen = 'Desconocida';
            try {
                const ipResponse = await fetch('https://api.ipify.org?format=json');
                const ipData = await ipResponse.json();
                ipOrigen = ipData.ip;
            } catch (err) {
                console.error("Error fetching IP:", err);
            }
            
            const saleRecord = {
                items: cart,
                total: numericTotal,
                date: serverTimestamp(),
                vendedor: auth.currentUser ? auth.currentUser.email : 'Desconocido',
                ipOrigen: ipOrigen
            };
            
            await addDoc(collection(db, 'ventas'), saleRecord);
            
            // Deduct stock atomically
            for (const item of cart) {
                if (item.id) {
                    const productRef = doc(db, 'productos', item.id);
                    await updateDoc(productRef, {
                        stock: increment(-item.quantity)
                    });
                }
            }
            
            if (paymentModal) {
                paymentModal.hide();
            }
            
            if (checkoutFinalTotal && cartTotalElement) {
                checkoutFinalTotal.textContent = cartTotalElement.textContent;
            }
            
            if (checkoutSuccessModal) {
                checkoutSuccessModal.show();
            }
            
            cart = [];
            updateCartUI();
            
        } catch (error) {
            console.error("Error al registrar la venta:", error);
            alert("Hubo un error al procesar la venta.");
        } finally {
            btnConfirmPayment.disabled = false;
            btnConfirmPayment.innerHTML = originalText;
        }
    });
}

// ==========================================
// TOAST NOTIFICATIONS LOGIC
// ==========================================
function showToast(message, type = 'success') {
    const toastEl = document.getElementById('system-toast');
    const toastBody = document.getElementById('system-toast-body');
    if (!toastEl || !toastBody) return;
    
    toastBody.textContent = message;
    
    // Reset classes
    toastEl.classList.remove('bg-success', 'bg-danger', 'bg-warning', 'text-white', 'text-dark');
    
    if (type === 'success') {
        toastEl.classList.add('bg-success', 'text-white');
    } else if (type === 'error') {
        toastEl.classList.add('bg-danger', 'text-white');
    } else if (type === 'warning') {
        toastEl.classList.add('bg-warning', 'text-dark');
    }
    
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();
}

// ==========================================
// FIADOS (CREDIT) LOGIC
// ==========================================
const btnFiar = document.getElementById('btn-fiar');
const btnConfirmFiar = document.getElementById('btn-confirm-fiar');
const fiarClientNameInput = document.getElementById('fiar-client-name');
const fiadosAccordion = document.getElementById('fiados-accordion');
const fiarModalElement = document.getElementById('fiar-modal');
let fiarModal;

if (fiarModalElement) {
    fiarModal = new bootstrap.Modal(fiarModalElement);
}

// 1. Open Fiar Modal
if (btnFiar) {
    btnFiar.addEventListener('click', () => {
        if (cart.length === 0) {
            showToast("El carrito está vacío. Agregue productos antes de fiar.", "error");
            return;
        }
        fiarClientNameInput.value = '';
        if (fiarModal) fiarModal.show();
    });
}

// 2. Confirm and Save Fiado
if (btnConfirmFiar) {
    btnConfirmFiar.addEventListener('click', async () => {
        const clientName = fiarClientNameInput.value.trim();
        if (!clientName) {
            showToast("Por favor ingrese el nombre del cliente.", "warning");
            return;
        }

        if (globalCajaClosed) {
            showToast("La caja del día ya ha sido cerrada", "error");
            return;
        }
        
        btnConfirmFiar.disabled = true;
        btnConfirmFiar.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Guardando...';

        try {
            const numericTotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
            
            const fiadoRecord = {
                cliente: clientName,
                items: cart,
                total: numericTotal,
                fechaFiado: serverTimestamp(),
                estado: 'pendiente',
                vendedor: auth.currentUser ? auth.currentUser.email : 'Desconocido'
            };
            
            await addDoc(collection(db, 'fiados'), fiadoRecord);
            
            // Deduct stock atomically
            for (const item of cart) {
                if (item.id) {
                    const productRef = doc(db, 'productos', item.id);
                    await updateDoc(productRef, {
                        stock: increment(-item.quantity)
                    });
                }
            }
            
            if (fiarModal) fiarModal.hide();
            
            cart = [];
            updateCartUI();
            
            showToast(`Cuenta por cobrar registrada para: ${clientName}`);
            
        } catch (error) {
            console.error("Error al registrar el fiado:", error);
            showToast("Hubo un error al registrar el fiado.", "error");
        } finally {
            btnConfirmFiar.disabled = false;
            btnConfirmFiar.innerHTML = 'Confirmar Fiado';
        }
    });
}

// 3. Fetch and Render Fiados Dashboard
async function fetchFiados() {
    if (!fiadosAccordion) return;
    
    fiadosAccordion.innerHTML = '<div class="text-center text-muted py-5"><i class="fa-solid fa-spinner fa-spin fa-3x"></i><p class="mt-3">Cargando cuentas...</p></div>';
    
    try {
        const snapshot = await getDocs(collection(db, 'fiados'));
        const pendingFiados = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.estado === 'pendiente') {
                pendingFiados.push({ id: doc.id, ...data });
            }
        });
        
        if (pendingFiados.length === 0) {
            fiadosAccordion.innerHTML = '<div class="text-center text-muted py-5"><i class="fa-solid fa-check-circle fa-3x text-success mb-3"></i><p class="fs-5">No hay cuentas por cobrar pendientes.</p></div>';
            return;
        }
        
        fiadosAccordion.innerHTML = ''; // Clear loading
        
        pendingFiados.forEach((fiado, index) => {
            // Timestamp to JS Date
            let dateObj = new Date();
            if (fiado.fechaFiado && typeof fiado.fechaFiado.toDate === 'function') {
                dateObj = fiado.fechaFiado.toDate();
            } else if (fiado.fechaFiado) {
                dateObj = new Date(fiado.fechaFiado);
            }
            
            const formattedDate = dateObj.toLocaleDateString();
            
            // Risk Assessment (Days difference)
            const today = new Date();
            const diffTime = Math.abs(today - dateObj);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let riskBadge = '';
            let headerClass = '';
            if (diffDays > 15) {
                riskBadge = '<span class="badge bg-danger ms-2"><i class="fa-solid fa-triangle-exclamation me-1"></i>Alerta Moroso</span>';
                headerClass = 'border-danger border-2';
            }
            
            const accordionItem = document.createElement('div');
            accordionItem.className = 'accordion-item mb-2 shadow-sm rounded border ' + headerClass;
            
            // Generate items list HTML
            let itemsHtml = '<ul class="list-group mb-3">';
            fiado.items.forEach(item => {
                itemsHtml += `<li class="list-group-item d-flex justify-content-between align-items-center">
                    ${item.quantity}x ${item.name}
                    <span>$${(item.quantity * parseFloat(item.price)).toFixed(2)}</span>
                </li>`;
            });
            itemsHtml += '</ul>';
            
            accordionItem.innerHTML = `
                <h2 class="accordion-header" id="heading-${fiado.id}">
                    <button class="accordion-button collapsed rounded" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${fiado.id}" aria-expanded="false" aria-controls="collapse-${fiado.id}">
                        <div class="d-flex justify-content-between w-100 pe-3 align-items-center">
                            <div>
                                <strong class="fs-5">${fiado.cliente}</strong>
                                ${riskBadge}
                                <div class="text-muted small mt-1">Fecha: ${formattedDate} (${diffDays} días)</div>
                            </div>
                            <strong class="fs-4 text-primary">$${parseFloat(fiado.total).toFixed(2)}</strong>
                        </div>
                    </button>
                </h2>
                <div id="collapse-${fiado.id}" class="accordion-collapse collapse" aria-labelledby="heading-${fiado.id}" data-bs-parent="#fiados-accordion">
                    <div class="accordion-body bg-light">
                        <h6 class="fw-bold mb-3">Detalle de la Deuda:</h6>
                        ${itemsHtml}
                        <button class="btn btn-success w-100 fw-bold py-2 btn-cobrar-deuda" data-id="${fiado.id}">
                            <i class="fa-solid fa-cash-register me-2"></i>Cobrar Deuda ($${parseFloat(fiado.total).toFixed(2)})
                        </button>
                    </div>
                </div>
            `;
            
            // Settle Debt Action (Two-Step Operation)
            accordionItem.querySelector('.btn-cobrar-deuda').addEventListener('click', async (e) => {
                const btn = e.target.closest('button');
                
                if (!btn.classList.contains('confirming')) {
                    const originalHTML = btn.innerHTML;
                    btn.classList.add('confirming', 'btn-warning');
                    btn.classList.remove('btn-success');
                    btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation me-2"></i>¿Confirmar Cobro?';
                    
                    // Reset after 3 seconds if not clicked again
                    setTimeout(() => {
                        if (btn.classList.contains('confirming')) {
                            btn.classList.remove('confirming', 'btn-warning');
                            btn.classList.add('btn-success');
                            btn.innerHTML = originalHTML;
                        }
                    }, 3000);
                    return;
                }
                
                btn.classList.remove('confirming', 'btn-warning');
                btn.classList.add('btn-success');
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Procesando...';
                
                try {
                    // Step 1: Update Fiado to 'pagado'
                    const fiadoRef = doc(db, 'fiados', fiado.id);
                    await updateDoc(fiadoRef, { estado: 'pagado' });
                    
                    // IP Logging for Audit
                    let ipOrigen = 'Desconocida';
                    try {
                        const ipResponse = await fetch('https://api.ipify.org?format=json');
                        const ipData = await ipResponse.json();
                        ipOrigen = ipData.ip;
                    } catch (err) {
                        console.error("Error fetching IP:", err);
                    }
                    
                    // Step 2: Record in Ventas for today's revenue
                    const saleRecord = {
                        items: fiado.items,
                        total: fiado.total,
                        date: serverTimestamp(),
                        tipo: 'cobro_fiado',
                        cliente: fiado.cliente,
                        vendedor: auth.currentUser ? auth.currentUser.email : 'Desconocido',
                        ipOrigen: ipOrigen
                    };
                    await addDoc(collection(db, 'ventas'), saleRecord);
                    
                    showToast('Deuda cobrada exitosamente. Ingreso registrado en ventas.');
                    fetchFiados(); // Refresh UI
                    
                } catch (error) {
                    console.error("Error al cobrar deuda:", error);
                    showToast("Error al procesar el cobro.", "error");
                    btn.disabled = false;
                    btn.innerHTML = `<i class="fa-solid fa-cash-register me-2"></i>Cobrar Deuda ($${parseFloat(fiado.total).toFixed(2)})`;
                }
            });
            
            fiadosAccordion.appendChild(accordionItem);
        });
        
    } catch (error) {
        console.error("Error fetching fiados:", error);
        fiadosAccordion.innerHTML = '<div class="alert alert-danger">Error al cargar las cuentas por cobrar.</div>';
    }
}

// ==========================================
// REPORTS LOGIC
// ==========================================
const reportDatePicker = document.getElementById('report-date-picker');
const reportsTableBody = document.querySelector('#reports-table tbody');
const bajasTableBody = document.querySelector('#bajas-table tbody');
const btnExportPdf = document.getElementById('btn-export-pdf');

// ==========================================
// CIERRE DE CAJA
// ==========================================
const btnCloseDrawer = document.getElementById('btn-close-drawer');
const btnSubmitCierre = document.getElementById('btn-submit-cierre');
const cierreModalEl = document.getElementById('cierre-caja-modal');
const cierreEsperadoDisplay = document.getElementById('cierre-esperado-display');
let cierreModal;
if (cierreModalEl) {
    cierreModal = new bootstrap.Modal(cierreModalEl);
}

if (btnCloseDrawer) {
    btnCloseDrawer.addEventListener('click', () => {
        const esperadoStr = document.getElementById('dashboard-esperado') ? document.getElementById('dashboard-esperado').textContent : '$0.00';
        if (cierreEsperadoDisplay) cierreEsperadoDisplay.textContent = esperadoStr;
        
        // Cierre de Caja Summary: Active Schedules
        const horariosList = document.getElementById('cierre-horarios-list');
        if (horariosList) {
            horariosList.innerHTML = '';
            if (currentDailySales && currentDailySales.length > 0) {
                const grouped = {};
                currentDailySales.forEach(sale => {
                    const vend = sale.vendedor || 'Desconocido';
                    let dateObj = new Date();
                    if (sale.date && typeof sale.date.toDate === 'function') dateObj = sale.date.toDate();
                    else if (sale.date) dateObj = new Date(sale.date);
                    
                    if (!grouped[vend]) {
                        grouped[vend] = { min: dateObj, max: dateObj };
                    } else {
                        if (dateObj < grouped[vend].min) grouped[vend].min = dateObj;
                        if (dateObj > grouped[vend].max) grouped[vend].max = dateObj;
                    }
                });
                for (const vend in grouped) {
                    const minStr = grouped[vend].min.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    const maxStr = grouped[vend].max.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                    const li = document.createElement('li');
                    li.className = "mb-1";
                    li.innerHTML = `<strong><i class="fa-solid fa-user-circle me-1"></i>${vend}:</strong> ${minStr} - ${maxStr}`;
                    horariosList.appendChild(li);
                }
            } else {
                horariosList.innerHTML = '<li class="text-muted fst-italic">No hay ventas registradas hoy.</li>';
            }
        }
        
        if (cierreModal) cierreModal.show();
    });
}

if (btnSubmitCierre) {
    btnSubmitCierre.addEventListener('click', async () => {
        if (!globalCajaDocId) {
            showToast('No se encontró una apertura de caja para hoy.', 'error');
            return;
        }
        
        btnSubmitCierre.disabled = true;
        btnSubmitCierre.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Cerrando...';
        
        try {
            const docRef = doc(db, 'caja_diaria', globalCajaDocId);
            await updateDoc(docRef, {
                closed: true,
                closedAt: serverTimestamp(),
                closedBy: auth.currentUser ? auth.currentUser.email : 'Desconocido'
            });
            
            globalCajaClosed = true;
            if (cierreModal) cierreModal.hide();
            
            showToast('La caja ha sido cerrada exitosamente.', 'success');
            
            if (btnCloseDrawer) {
                btnCloseDrawer.disabled = true;
                btnCloseDrawer.classList.remove('btn-warning');
                btnCloseDrawer.classList.add('btn-secondary');
            }
        } catch (error) {
            console.error("Error closing drawer:", error);
            showToast('Hubo un error al cerrar la caja.', 'error');
        } finally {
            btnSubmitCierre.disabled = false;
            btnSubmitCierre.innerHTML = '<i class="fa-solid fa-lock me-2"></i>Cerrar Caja Definitivamente';
        }
    });
}

// 1. Load Daily Sales Table
let currentDailySales = [];
window.loadDailySalesTable = async function(dateString) {
    if (!reportsTableBody) return;
    
    reportsTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4"><i class="fa-solid fa-spinner fa-spin me-2"></i>Cargando ventas...</td></tr>';
    
    try {
        const [year, month, day] = dateString.split('-');
        
        // Start of day
        const startOfDay = new Date(year, month - 1, day);
        startOfDay.setHours(0, 0, 0, 0);
        
        // End of day
        const endOfDay = new Date(year, month - 1, day);
        endOfDay.setHours(23, 59, 59, 999);
        
        const q = query(
            collection(db, 'ventas'),
            where('date', '>=', startOfDay),
            where('date', '<=', endOfDay)
        );
        
        const snapshot = await getDocs(q);
        
        // Fetch Fondo Inicial for this date
        let fondoInicial = 0;
        let isClosedForThisDate = false;
        const qCaja = query(collection(db, 'caja_diaria'), where('dateString', '==', dateString));
        const cajaSnap = await getDocs(qCaja);
        if (!cajaSnap.empty) {
            fondoInicial = parseFloat(cajaSnap.docs[0].data().monto) || 0;
            isClosedForThisDate = cajaSnap.docs[0].data().closed || false;
        }
        
        const btnCloseDrawer = document.getElementById('btn-close-drawer');
        if (btnCloseDrawer) {
            const todayStr = new Date().toLocaleDateString('en-CA');
            if (isClosedForThisDate || dateString !== todayStr) {
                btnCloseDrawer.disabled = true;
                btnCloseDrawer.classList.remove('btn-warning');
                btnCloseDrawer.classList.add('btn-secondary');
            } else {
                btnCloseDrawer.disabled = false;
                btnCloseDrawer.classList.remove('btn-secondary');
                btnCloseDrawer.classList.add('btn-warning');
            }
        }
        
        const dashFondo = document.getElementById('dashboard-fondo');
        const dashIngresos = document.getElementById('dashboard-ingresos');
        const dashEsperado = document.getElementById('dashboard-esperado');
        
        if (snapshot.empty) {
            reportsTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No se encontraron ventas para esta fecha</td></tr>';
            if (dashFondo) dashFondo.textContent = '$' + fondoInicial.toFixed(2);
            if (dashIngresos) dashIngresos.textContent = '$0.00';
            if (dashEsperado) dashEsperado.textContent = '$' + fondoInicial.toFixed(2);
            return;
        }
        
        reportsTableBody.innerHTML = '';
        
        // Sort explicitly by date (optional, but good practice since Firebase doesn't implicitly order when doing range filters on the same field unless requested)
        const sales = [];
        let totalIngresos = 0;
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            sales.push(data);
            totalIngresos += parseFloat(data.total) || 0;
        });
        sales.sort((a, b) => b.date - a.date); // Descending by time
        currentDailySales = sales;
        
        if (dashFondo) dashFondo.textContent = '$' + fondoInicial.toFixed(2);
        if (dashIngresos) dashIngresos.textContent = '$' + totalIngresos.toFixed(2);
        if (dashEsperado) dashEsperado.textContent = '$' + (fondoInicial + totalIngresos).toFixed(2);
        
        sales.forEach(sale => {
            let dateObj = new Date();
            if (sale.date && typeof sale.date.toDate === 'function') {
                dateObj = sale.date.toDate();
            } else if (sale.date) {
                dateObj = new Date(sale.date);
            }
            
            const timeString = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            // Calculate total items
            const totalItems = sale.items ? sale.items.reduce((sum, item) => sum + parseInt(item.quantity), 0) : 0;
            const totalVal = parseFloat(sale.total).toFixed(2);
            const itemsJson = sale.items ? JSON.stringify(sale.items).replace(/"/g, '&quot;') : '[]';
            const vendedorAttr = sale.vendedor || 'Desconocido';
            const clienteAttr = sale.cliente || '';
            const ipAttr = sale.ipOrigen || 'N/A';
            
            const tr = document.createElement('tr');
            
            let badge = '';
            if (sale.tipo === 'cobro_fiado') {
                badge = `<span class="badge bg-warning text-dark ms-2">Fiado: ${sale.cliente}</span>`;
            }
            
            tr.innerHTML = `
                <td>
                    <div class="fw-bold">${timeString}</div>
                    <small class="text-muted">${sale.vendedor || 'N/A'}</small>
                </td>
                <td>${totalItems} artículos</td>
                <td class="fw-bold text-success">$${totalVal} ${badge}</td>
                <td><small class="text-muted"><i class="fa-solid fa-network-wired me-1"></i>${ipAttr}</small></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary btn-view-details" data-items="${itemsJson}" data-total="${totalVal}" data-vendedor="${vendedorAttr}" data-cliente="${clienteAttr}"><i class="fa-solid fa-eye"></i></button>
                </td>
            `;
            reportsTableBody.appendChild(tr);
        });
        
    } catch (error) {
        console.error("Error loading daily sales:", error);
        reportsTableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-4">Error al cargar el reporte.</td></tr>';
    }
    
    // Also load Bajas for this date
    loadBajasTable(dateString);
};

window.loadBajasTable = async function(dateString) {
    if (!bajasTableBody) return;
    
    bajasTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><i class="fa-solid fa-spinner fa-spin me-2"></i>Cargando bajas...</td></tr>';
    
    try {
        const [year, month, day] = dateString.split('-');
        
        // Start of day
        const startOfDay = new Date(year, month - 1, day);
        startOfDay.setHours(0, 0, 0, 0);
        
        // End of day
        const endOfDay = new Date(year, month - 1, day);
        endOfDay.setHours(23, 59, 59, 999);
        
        const q = query(
            collection(db, 'bajas'),
            where('date', '>=', startOfDay),
            where('date', '<=', endOfDay)
        );
        
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            bajasTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">No se encontraron bajas para esta fecha</td></tr>';
            return;
        }
        
        bajasTableBody.innerHTML = '';
        
        const bajas = [];
        snapshot.forEach(docSnap => {
            bajas.push(docSnap.data());
        });
        bajas.sort((a, b) => b.date - a.date); // Descending by time
        
        bajas.forEach(baja => {
            let dateObj = new Date();
            if (baja.date && typeof baja.date.toDate === 'function') {
                dateObj = baja.date.toDate();
            } else if (baja.date) {
                dateObj = new Date(baja.date);
            }
            
            const timeString = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="fw-bold">${timeString}</div>
                </td>
                <td class="fw-bold text-danger">${baja.productName || 'N/A'}</td>
                <td><span class="badge bg-secondary">${baja.cantidad}</span></td>
                <td><small class="text-muted">${baja.motivo}</small></td>
                <td><small class="text-muted"><i class="fa-solid fa-user me-1"></i>${baja.registradoPor || 'Desconocido'}</small></td>
            `;
            bajasTableBody.appendChild(tr);
        });
        
    } catch (error) {
        console.error("Error loading bajas:", error);
        bajasTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">Error al cargar las bajas.</td></tr>';
    }
};

// Listen for "Ver Detalles" (Eye icon) clicks
if (reportsTableBody) {
    reportsTableBody.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-view-details');
        if (!btn) return;
        
        const itemsJson = btn.getAttribute('data-items');
        const total = btn.getAttribute('data-total');
        const vendedor = btn.getAttribute('data-vendedor');
        const cliente = btn.getAttribute('data-cliente');
        
        let items = [];
        try {
            items = JSON.parse(itemsJson || '[]');
        } catch (err) {
            console.error("Error parsing items JSON", err);
        }
        
        const receiptList = document.getElementById('receipt-items-list');
        const receiptTotal = document.getElementById('receipt-total');
        const receiptMetadata = document.getElementById('receipt-metadata');
        
        if (receiptList && receiptTotal && receiptMetadata) {
            receiptMetadata.innerHTML = `<strong>Cajero:</strong> ${vendedor}`;
            if (cliente) {
                receiptMetadata.innerHTML += `<br><strong>Cliente:</strong> ${cliente} (Fiado Cobrado)`;
            }
            
            receiptList.innerHTML = '';
            items.forEach(item => {
                const li = document.createElement('li');
                li.className = 'd-flex justify-content-between mb-1 small';
                li.innerHTML = `
                    <span>${item.quantity}x ${item.name}</span>
                    <span>$${(parseFloat(item.price) * parseInt(item.quantity)).toFixed(2)}</span>
                `;
                receiptList.appendChild(li);
            });
            
            receiptTotal.textContent = `$${total}`;
            
            const modalEl = document.getElementById('sale-details-modal');
            if (modalEl) {
                const modal = new bootstrap.Modal(modalEl);
                modal.show();
            }
        }
    });
}

if (reportDatePicker) {
    reportDatePicker.addEventListener('change', (e) => {
        if (e.target.value) {
            loadDailySalesTable(e.target.value);
        }
    });
}

// 2. Export PDF Mock Logic
if (btnExportPdf) {
    btnExportPdf.addEventListener('click', async () => {
        btnExportPdf.disabled = true;
        const originalHtml = btnExportPdf.innerHTML;
        btnExportPdf.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-1"></i>Generando...';
        
        try {
            const today = new Date();
            let startOfRange = new Date(today);
            let endOfRange = new Date(today);
            endOfRange.setHours(23, 59, 59, 999);
            
            if (document.getElementById('filter-today').checked) {
                startOfRange.setHours(0, 0, 0, 0);
            } else if (document.getElementById('filter-week').checked) {
                const day = startOfRange.getDay();
                const diff = startOfRange.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
                startOfRange.setDate(diff);
                startOfRange.setHours(0, 0, 0, 0);
            } else if (document.getElementById('filter-month').checked) {
                startOfRange.setDate(1);
                startOfRange.setHours(0, 0, 0, 0);
            }
            
            const q = query(
                collection(db, 'ventas'),
                where('date', '>=', startOfRange),
                where('date', '<=', endOfRange)
            );
            
            const snapshot = await getDocs(q);
            const ventasFound = snapshot.size;
            
            const exportData = [];
            snapshot.forEach(docSnap => exportData.push(docSnap.data()));
            
            if (ventasFound === 0) {
                showToast("No hay ventas en este rango para exportar.", "warning");
                return;
            }
            
            // Consolidate data
            const summaryMap = {};
            let grandTotal = 0;
            
            exportData.forEach(sale => {
                if (sale.items) {
                    sale.items.forEach(item => {
                        if (!summaryMap[item.name]) {
                            summaryMap[item.name] = { qty: 0, subtotal: 0 };
                        }
                        summaryMap[item.name].qty += parseInt(item.quantity);
                        const itemTotal = parseFloat(item.price) * parseInt(item.quantity);
                        summaryMap[item.name].subtotal += itemTotal;
                        grandTotal += itemTotal;
                    });
                }
            });
            
            const tableBody = Object.keys(summaryMap).map(productName => {
                return [
                    productName,
                    summaryMap[productName].qty,
                    `$${summaryMap[productName].subtotal.toFixed(2)}`
                ];
            });
            
            // Generate PDF using jsPDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            let reportDateStr = "";
            if (document.getElementById('filter-today').checked) {
                reportDateStr = `Día: ${startOfRange.toLocaleDateString()}`;
            } else if (document.getElementById('filter-week').checked) {
                reportDateStr = `Semana: ${startOfRange.toLocaleDateString()} - ${endOfRange.toLocaleDateString()}`;
            } else if (document.getElementById('filter-month').checked) {
                reportDateStr = `Mes: ${startOfRange.toLocaleDateString()} - ${endOfRange.toLocaleDateString()}`;
            }
            
            doc.setFontSize(18);
            doc.text("Reporte Consolidado de Ventas", 14, 20);
            doc.setFontSize(12);
            doc.text("Panadería Reina del Cisne", 14, 28);
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(reportDateStr, 14, 34);
            
            doc.autoTable({
                startY: 40,
                head: [['Producto', 'Cantidad Vendida', 'Total Ingresos']],
                body: tableBody,
                foot: [['TOTAL GENERAL', '', `$${grandTotal.toFixed(2)}`]],
                theme: 'striped',
                headStyles: { fillColor: [74, 59, 44] }, // Bakery brown theme
                footStyles: { fillColor: [74, 59, 44], fontStyle: 'bold' }
            });
            
            const timestamp = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}-${String(today.getHours()).padStart(2,'0')}${String(today.getMinutes()).padStart(2,'0')}`;
            doc.save(`RC-Ventas-${timestamp}.pdf`);
            
            showToast(`Reporte PDF generado exitosamente: ${ventasFound} ventas consolidadas.`);
            
        } catch (error) {
            console.error("Error fetching range for PDF:", error);
            showToast("Error al generar PDF.", "error");
        } finally {
            btnExportPdf.disabled = false;
            btnExportPdf.innerHTML = originalHtml;
        }
    });
}
