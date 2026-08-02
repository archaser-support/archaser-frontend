import { apiFetch } from "@/utils/apiFetch";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

import { useToast } from "@/shared/layout-components/toast/ToastProvider";

interface CommentProps {
    customerId: string;
    onCommentAdded: () => void;
}

export default function Comment({ customerId, onCommentAdded }: CommentProps) {
    const { t } = useTranslation(["customers", "common"]);
    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { showToast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!comment.trim()) {
            showToast("Please enter a comment", "error");
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await apiFetch(
                `/api/entities/customers/${customerId}/comments`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        comment: comment.trim(),
                    }),
                }
            );

            if (!response.ok) {
                throw new Error("Failed to add comment");
            }

            setComment("");
            onCommentAdded();
            showToast("Comment added successfully", "success");
        } catch (error: any) {
            console.error("Error adding comment:", error);
            showToast(error.message || "Failed to add comment", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label
                    htmlFor="comment"
                    className="block text-sm font-medium text-gray-700"
                >
                    {t("Add Comment")}
                </label>
                <textarea
                    id="comment"
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={t("Enter your comment here...")}
                />
            </div>
            <div>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                >
                    {isSubmitting ? t("Adding...") : t("Add Comment")}
                </button>
            </div>
        </form>
    );
}
