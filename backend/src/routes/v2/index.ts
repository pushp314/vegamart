import { Router } from "express";

// Version 2 initially mirrors version 1's surface area. Version-specific
// behavior can diverge here without affecting v1 clients.
import healthRoutes from "../v1/health.routes";
import authRoutes from "../v1/auth.routes";
import userRoutes from "../v1/user.routes";
import categoryRoutes from "../v1/category.routes";
import vendorRoutes from "../v1/vendor.routes";
import productRoutes from "../v1/product.routes";
import inventoryRoutes from "../v1/inventory.routes";
import searchRoutes from "../v1/search.routes";
import cartRoutes from "../v1/cart.routes";
import wishlistRoutes from "../v1/wishlist.routes";
import couponRoutes from "../v1/coupon.routes";
import addressRoutes from "../v1/address.routes";
import checkoutRoutes from "../v1/checkout.routes";
import paymentRoutes from "../v1/payment.routes";
import orderRoutes from "../v1/order.routes";
import notificationRoutes from "../v1/notification.routes";
import uploadRoutes from "../v1/upload.routes";
import adminRoutes from "../v1/admin.routes";
import publicSettingsRoutes from "../v1/public-settings.routes";

const v2Router = Router();

v2Router.use(healthRoutes);
v2Router.use(authRoutes);
v2Router.use("/users", userRoutes);
v2Router.use(categoryRoutes);
v2Router.use(orderRoutes);
v2Router.use(vendorRoutes);
v2Router.use(productRoutes);
v2Router.use("/inventory", inventoryRoutes);
v2Router.use(searchRoutes);
v2Router.use(cartRoutes);
v2Router.use(wishlistRoutes);
v2Router.use(couponRoutes);
v2Router.use(addressRoutes);
v2Router.use(checkoutRoutes);
v2Router.use(paymentRoutes);
v2Router.use(notificationRoutes);
v2Router.use(uploadRoutes);
v2Router.use("/admin", adminRoutes);
v2Router.use(publicSettingsRoutes);

export default v2Router;
