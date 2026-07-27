"use client";
import React, { useEffect } from "react";

const Seo = ({ title }: any) => {
    useEffect(() => {
        document.title = title;
    }, []);

    return <></>;
};

export default Seo;
