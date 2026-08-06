import type { Request, Response } from "express";

import * as couponRepo from "../repositories/coupon.repository";
import { sendSuccess } from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";

export const getOffers = asyncHandler(async (_req: Request, res: Response) => {
  const { rows } = await couponRepo.listCoupons({ isActive: true }, 0, 10);
  
  const offers = rows.map((coupon, i) => {
    let title = coupon.code;
    if (coupon.type === "PERCENTAGE") {
      title = `${Number(coupon.value)}% OFF`;
    } else if (coupon.type === "FIXED") {
      title = `₹${Number(coupon.value)} OFF`;
    } else if (coupon.type === "FREE_DELIVERY") {
      title = "FREE DELIVERY";
    }

    const tones = ["green", "amber", "rose"];
    const tone = tones[i % tones.length];

    let sub = "Use this offer now!";
    const maxDiscount = coupon.max_discount ? Number(coupon.max_discount) : 0;
    const minOrderValue = coupon.min_order_value ? Number(coupon.min_order_value) : 0;

    if (maxDiscount > 0) {
      sub = `Up to ₹${maxDiscount} off`;
    } else if (minOrderValue > 0) {
      sub = `On orders over ₹${minOrderValue}`;
    }

    return {
      id: coupon.id,
      tag: coupon.code,
      title,
      sub,
      tone,
    };
  });

  return sendSuccess(res, offers);
});
