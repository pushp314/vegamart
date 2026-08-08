const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { detailSelect } = require('./src/repositories/order.repository'); // wait, I can't require TS directly.
