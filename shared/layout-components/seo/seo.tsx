"use client";
import { useLayoutEffect } from "react";

const Seo = ({ title }: { title: string }) => {
    useLayoutEffect(() => {
        if (!title) {
            return;
        }
        document.title = title;
    }, [title]);

    return <></>;
};

export default Seo;
