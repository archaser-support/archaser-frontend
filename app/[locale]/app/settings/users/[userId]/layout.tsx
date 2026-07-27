"use client";

import React from "react";

interface UserLayoutProps {
    children: React.ReactNode;
}

const UserLayout: React.FC<UserLayoutProps> = ({ children }) => {
    return <div>{children}</div>;
};

export default UserLayout;
