import { Router } from "express";

import healthRoutes from "./health.routes";
import metricsRoutes from "./metrics.routes";
import integrationRoutes, { integrationAdminRoutes } from "./integration.routes";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import categoryRoutes from "./category.routes";
import vendorRoutes from "./vendor.routes";
import discoveryRoutes from "./discovery.routes";
import productRoutes from "./product.routes";
import inventoryRoutes from "./inventory.routes";
import searchRoutes from "./search.routes";
import cartRoutes from "./cart.routes";
import wishlistRoutes from "./wishlist.routes";
import couponRoutes from "./coupon.routes";
import addressRoutes from "./address.routes";
import checkoutRoutes from "./checkout.routes";
import paymentRoutes from "./payment.routes";
import orderRoutes from "./order.routes";
import notificationRoutes from "./notification.routes";
import uploadRoutes from "./upload.routes";
import adminRoutes from "./admin.routes";
import publicSettingsRoutes from "./public-settings.routes";
import offersRoutes from "./offers.routes";

import deliveryRoutes from "./delivery.routes";
import contactRoutes from "./contact.routes";
import { faqRoutes } from "./faq.routes";

const v1Router = Router();

v1Router.use(healthRoutes);
v1Router.use(metricsRoutes);
v1Router.use(integrationRoutes);
v1Router.use(authRoutes);
v1Router.use("/users", userRoutes);
v1Router.use(categoryRoutes);
v1Router.use(orderRoutes);
v1Router.use(vendorRoutes);
v1Router.use(discoveryRoutes);
v1Router.use(productRoutes);
v1Router.use("/inventory", inventoryRoutes);
v1Router.use(searchRoutes);
v1Router.use(cartRoutes);
v1Router.use(wishlistRoutes);
v1Router.use(couponRoutes);
v1Router.use(addressRoutes);
v1Router.use(checkoutRoutes);
v1Router.use(paymentRoutes);
v1Router.use(notificationRoutes);
v1Router.use(uploadRoutes);
v1Router.use("/admin", adminRoutes);
v1Router.use("/admin", integrationAdminRoutes);
v1Router.use(publicSettingsRoutes);
v1Router.use(offersRoutes);

v1Router.use(deliveryRoutes);
v1Router.use(contactRoutes);
v1Router.use("/faqs", faqRoutes);

export default v1Router;
