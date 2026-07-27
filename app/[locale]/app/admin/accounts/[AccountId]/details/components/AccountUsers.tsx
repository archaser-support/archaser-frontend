"use client";

import Box from "@mui/material/Box";
import React from "react";

import UserList from "@/shared/components/UserList";

import { AccountDisplayData } from "../types";

interface AccountUsersProps {
    customer: AccountDisplayData;
    onFieldChange: (key: string, value: any) => void;
    validationErrors?: Record<string, string>;
    REQUIRED_FIELDS?: string[];
    selectedCountry?: any;
    selectedState?: any;
    decodeLogo?: (
        logoData?: string | Uint8Array | { data: Uint8Array }
    ) => string;
}

const AccountUsers: React.FC<AccountUsersProps> = ({ customer }) => {

    return (
        <Box
            sx={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                minHeight: "500px",
            }}
        >
            <Box sx={{ flex: 1, minHeight: "500px" }}>
                <UserList
                    accountId={customer.id}
                    variant="standalone"
                    rowsPerPage={10}
                    showDescription={false}
                    height="100%"
                />
            </Box>
        </Box>
    );
};

export default AccountUsers;
