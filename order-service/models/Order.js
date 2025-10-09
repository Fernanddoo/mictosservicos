const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productId: { type: Number, required: true },
    name: { type: String, required: true }, // Denormalizado para facilitar a consulta
    quantity: { type: Number, required: true },
    price: { type: mongoose.Schema.Types.Decimal128, required: true } // Preço no momento da compra
}, { _id: false });

const orderSchema = new mongoose.Schema({
    // O Mongoose cria um _id automaticamente (String)
    userId: { type: Number, required: true },
    total: { type: mongoose.Schema.Types.Decimal128, required: true },
    status: {
        type: String,
        enum: ['AGUARDANDO_PAGAMENTO', 'FALHA_NO_PAGAMENTO', 'PAGO', 'CANCELADO'],
        default: 'AGUARDANDO_PAGAMENTO'
    },
    products: [productSchema],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);