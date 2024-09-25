const Product = require("../models/product");
const Order = require("../models/order");
const fs = require("fs");
const items_per_page = 1;
const pdfDocument = require("pdfkit");
const path = require("path");
const product = require("../models/product");
const stripe = require("stripe")(
  "sk_test_51Mpme7SHEfH1Sdnxgn1ENIWVqX9pKZPaiRwndHBqv0dQ1vr9zLBk6kNO17p6pAc6UG7Rw6BfiaGjHHQphO3zijcB00Wi5xdz4j"
);
exports.getProducts = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;
  Product.find()
    .countDocuments()
    .then((numProducts) => {
      totalItems = numProducts;
      return Product.find()
        .skip((page - 1) * items_per_page)
        .limit(items_per_page);
    })
    .then((products) => {
      res.render("shop/product-list", {
        prods: products,
        pageTitle: "Products",
        path: "/products",
        // totalProducts:totalItems,
        currentPage: page,
        hasNextPage: items_per_page * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1,
        lastPage: Math.ceil(totalItems / items_per_page),
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      res.render("shop/product-detail", {
        product: product,
        pageTitle: product.title,
        path: "/products",
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getIndex = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;
  Product.find()
    .countDocuments()
    .then((numProducts) => {
      totalItems = numProducts;
      return Product.find()
        .skip((page - 1) * items_per_page)
        .limit(items_per_page);
    })
    .then((products) => {
      res.render("shop/index", {
        prods: products,
        pageTitle: "Shop",
        path: "/",
        // totalProducts:totalItems,
        currentPage: page,
        hasNextPage: items_per_page * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1,
        lastPage: Math.ceil(totalItems / items_per_page),
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      const products = user.cart.items;
      res.render("shop/cart", {
        path: "/cart",
        pageTitle: "Your Cart",
        products: products,
      });
    })
    .catch((err) => {
      console.log(err);
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then((product) => {
      return req.user.addToCart(product);
    })
    .then((result) => {
      console.log(result);
      res.redirect("/cart");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then((result) => {
      res.redirect("/cart");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCheckout = (req, res, next) => {
  let products;
  let total = 0;
  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      products = user.cart.items;
      products.forEach((items) => {
        total += items.quantity * items.productId.price;
      });
      return stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: product.map((p) => {
          return {
            name: p.productId.title,
            description: p.productId.description,
            amount: p.productId.price * 100,
            currency: "usd",
            quantity: p.quantity,
          };
        }),
        success_url:
          req.protocol + "://" + req.get("host") + "checkout/success", // => http://localhost:3000
        cancel_url: req.protocol + "://" + req.get("host") + "checkout/cancel",
      });
    })
    .then((session) => {
      res.render("shop/checkout", {
        path: "/checkout",
        pageTitle: "Checkout",
        products: products,
        totalSum: total,
        sessionId: session.id,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};
exports.getCheckoutSuccess = (req, res, next) => {
  req.user
    .populate("cart.items.productId")
    .execPopulate()
    .then((user) => {
      const products = user.cart.items.map((i) => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user,
        },
        products: products,
      });
      return order.save();
    })
    .then((result) => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect("/orders");
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

// exports.postOrder = (req, res, next) => {
//   req.user
//     .populate('cart.items.productId')
//     .execPopulate()
//     .then(user => {
//       const products = user.cart.items.map(i => {
//         return { quantity: i.quantity, product: { ...i.productId._doc } };
//       });
//       const order = new Order({
//         user: {
//           email: req.user.email,
//           userId: req.user
//         },
//         products: products
//       });
//       return order.save();
//     })
//     .then(result => {
//       return req.user.clearCart();
//     })
//     .then(() => {
//       res.redirect('/orders');
//     })
//     .catch(err => {
//       const error = new Error(err);
//       error.httpStatusCode = 500;
//       return next(error);
//     });
// };

exports.getOrders = (req, res, next) => {
  Order.find({ "user.userId": req.user._id })
    .then((orders) => {
      res.render("shop/orders", {
        path: "/orders",
        pageTitle: "Your Orders",
        orders: orders,
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};
exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  Order.findById(orderId).then((order) => {
    if (!order) {
      return next(new Error("No Order Found!"));
    }
    if (order.user.userId.toString() !== req.user._id.toString()) {
      return next(new Error("Unauthorized User"));
    }
    const invoicename = "invoice-" + orderId + ".pdf";
    const invoicepath = path.join("data", "invoices", invoicename);
    const pdfDoc = new pdfDocument();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'inline; filename="' + invoicename + '"'
    );
    pdfDoc.pipe(fs.createWriteStream(invoicepath));
    pdfDoc.pipe(res);
    // pdfDoc.text("Hello World!");  // content of the pdf
    pdfDoc.fontSize("26").text("invoice", { underline: true });
    pdfDoc.text("-------------------------------------");
    let totprice = 0;
    order.products.forEach((prod) => {
      totprice += prod.quantity * prod.product.price;
      pdfDoc
        .fontSize("14")
        .text(
          prod.product.title +
            " - " +
            prod.quantity +
            "x" +
            "$" +
            prod.product.price
        );
    });
    pdfDoc.text("Total Price: $" + totprice);
    pdfDoc.end();
    // fs.readFile(invoicepath,(err,data)=>{
    //    if(err){
    //     return next(err);
    //    }
    //    res.setHeader('Content-Type','application/pdf');
    //    res.setHeader('Content-Disposition','inline; filename="'+ invoicename +'"');
    //    res.send(data);
    // });
    // const file = fs.createReadStream(invoicePath);

    //     file.pipe(res);
    // }).catch(err=>next(err));
  });
};
exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then((product) => {
      res.render("shop/product-detail", {
        product: product,
        pageTitle: product.title,
        path: "/products",
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
}

exports.getSearch=(req,res,next)=>{
  Product.find().then(product=>{
    // console.log(product);
  }).catch(err=>{
    console.log(err);
  });
  res.render('shop/search', {
    pageTitle: 'Search a Product',
    path: '/search',
    products:product,
    hasError: false,
    errorMessage: null,
    editing:false,
    validationErrors: []
  });
}

exports.getSearchProduct = (req,res,next)=>{
  const title = req.query.title;
  // console.log(title);
  const page = +req.query.page || 1;
  Product.find().then(product=>{
    // console.log(product);
  }).catch(err=>{
    console.log(err);
  });
  let totalItems;
  Product.find()
    .countDocuments()
    .then((numProducts) => {
      totalItems = numProducts;
      return Product.find()
        .skip((page - 1) * items_per_page)
        .limit(items_per_page);
    })
    .then((products) => {
      res.render("shop/getsearchedProduct", {
        prods: products,
        pageTitle: "Products",
        path: "/products",

        // totalProducts:totalItems,
        currentPage: page,
        hasNextPage: items_per_page * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage: page + 1,
        prevPage: page - 1,
        lastPage: Math.ceil(totalItems / items_per_page),
      });
    })
    .catch((err) => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

