import NextAuth from "next-auth";

import { authOptions } from "@/lib/authOptions";

export { authOptions } from "@/lib/authOptions";

export default NextAuth(authOptions);
