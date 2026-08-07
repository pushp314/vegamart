const { z } = require('zod');
const s = z.coerce.number().min(0);
console.log(s.safeParse(undefined));
