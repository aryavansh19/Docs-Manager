import React from "react";
import LegalPage from "../components/LegalPage";

const SECTIONS = [
    {
        title: "Acceptance of terms",
        body: (
            <p>
                By accessing or using DocsFlow you agree to these Terms of Service. If you
                do not agree with them, please do not use the service.
            </p>
        ),
    },
    {
        title: "Use of the service",
        body: (
            <>
                <p>
                    You agree to use DocsFlow for lawful purposes only, and you remain
                    responsible for every document you send through it. Specifically, you
                    must not use the service to:
                </p>
                <ul className="ml-1 space-y-2">
                    {[
                        "Store or transmit unlawful material.",
                        "Upload content you do not have the right to store.",
                        "Attempt to access another user's account, files or index.",
                        "Interfere with, overload or reverse engineer the service.",
                    ].map((item) => (
                        <li key={item} className="flex gap-2.5">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-flame" />
                            <span>{item}</span>
                        </li>
                    ))}
                </ul>
            </>
        ),
    },
    {
        title: "Your account",
        body: (
            <p>
                Your account is tied to your Google identity and your WhatsApp number. You
                are responsible for keeping access to both secure, and for activity that
                happens under your account. Tell us promptly if you believe it has been
                compromised.
            </p>
        ),
    },
    {
        title: "Google Drive access",
        body: (
            <p>
                DocsFlow acts on your Google Drive only with the permission you grant during
                sign-in, and only to create folders and upload the documents you send. You
                may revoke that access at any time from your Google Account settings, which
                stops all filing immediately. Files already written to your Drive stay
                there, under your ownership.
            </p>
        ),
    },
    {
        title: "Availability and accuracy",
        body: (
            <p>
                The service is provided on an "as is" basis. Automated classification is
                helpful but not perfect: a document may occasionally be named or filed in a
                way you would not have chosen. Review anything important, and treat DocsFlow
                as a convenience rather than your only copy or system of record.
            </p>
        ),
    },
    {
        title: "Intellectual property",
        body: (
            <p>
                The service, its content and its features remain the property of DocsFlow and
                its licensors. Your documents remain entirely yours. Our name and branding
                may not be used to represent another product or service without written
                consent.
            </p>
        ),
    },
    {
        title: "Termination",
        body: (
            <p>
                We may suspend or terminate access if these Terms are breached. You may stop
                using DocsFlow at any time by revoking Drive access and asking us to delete
                your account. On termination your right to use the service ends, and your
                files remain in your own Drive.
            </p>
        ),
    },
    {
        title: "Contact",
        body: (
            <p>
                Questions about these Terms? Email{" "}
                <a
                    href="mailto:support@docsflow.com"
                    className="link-wipe font-bold text-ink"
                >
                    support@docsflow.com
                </a>
                .
            </p>
        ),
    },
];

export default function TermsOfService() {
    return (
        <LegalPage
            title="Terms of Service"
            updated={new Date().toLocaleDateString()}
            accent="bg-cobalt-soft"
            intro="The ground rules for using DocsFlow: what you're responsible for, what we're responsible for, and what happens to your files if either of us walks away."
            sections={SECTIONS}
        />
    );
}
