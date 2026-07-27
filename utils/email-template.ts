import AppUrls from "./appUrls";

export const disputeEmailTemplate = (
    assignee: string,
    customerName: string,
    invoiceNumber: string,
    disputeId: string,
    disputeAmount: string,
    disputeReason: string,
    dateOfDispute: string,
    customerId: string, // <-- added customerId here
    comment: string
) => {
    const disputeLink =
        process.env.NEXTAUTH_URL + AppUrls.Customer_DISPUTES(customerId, disputeId);

    return `
  <!DOCTYPE html>
  <html>
  <head>
      <meta charset="UTF-8">
      <title>[ARchaser] You've been assigned a new dispute to review</title>
  </head>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9f9f9; padding: 20px;">
      <div style="max-width: 600px; margin: auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
          <h2 style="color: rgb(132, 90, 223); text-align: center;">New Dispute Assigned</h2>
  
          <p>Hi ${assignee},</p>
  
          <p>You've been assigned a new dispute case in <strong>ARchaser</strong>. Please review and take the necessary action as soon as possible.</p>
  
          <h3 style="color: rgb(132, 90, 223);">Dispute Summary:</h3>
          <ul>
              <li><strong>Customer Name:</strong> ${customerName}</li>
              <li><strong>Invoice Number:</strong> ${invoiceNumber}</li>
              <li><strong>Dispute ID:</strong> ${disputeId}</li>
              <li><strong>Disputed Amount:</strong> ${disputeAmount}</li>
              <li><strong>Dispute Reason:</strong> ${disputeReason}</li>
              <li><strong>Date of Dispute:</strong> ${dateOfDispute}</li>
              <li><strong>Comment:</strong> ${comment && comment.trim().length > 0 ? comment : "No comments"}</li>
          </ul>
  
          <div style="text-align: center; margin: 30px 0;">
              <a href="${disputeLink}" style="background-color: rgb(132, 90, 223); color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                  View Dispute
              </a>
          </div>
  
          <p>Thank you,<br>
          The ARchaser Team</p>
      </div>
  </body>
  </html>
  `;
};
