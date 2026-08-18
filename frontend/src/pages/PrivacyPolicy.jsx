import React from "react";
import LegalPage from "../components/LegalPage";

const SECTIONS = [
    {
        title: "Introduction",
        body: (
            <p>
                DocsFlow ("we", "our", "us") provides intelligent document organization.
                This policy explains what we collect, why we collect it, and how we
                safeguard it when you use our website and WhatsApp service.
            </p>
        ),
    },
    {
        title: "Information we collect",
        body: (
            <>
                <p>We collect only what the service needs to function:</p>
                <ul className="ml-1 space-y-2">
                    {[
                        "Your name and email address, from Google sign-in.",
                        "Your WhatsApp number, so we can match incoming messages to your account.",
                        "A Google Drive authorization token, so we can create folders and upload files on your behalf.",
                        "An index of your filed documents: file names, folder locations and tags.",
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
        title: "How we use it",
        body: (
            <>
                <p>Your information is used to:</p>
                <ul className="ml-1 space-y-2">
                    {[
                        "Classify documents you forward and file them in your Drive.",
                        "Power search, so you can ask for a document in plain language.",
                        "Send you service notices and respond to support requests.",
                    ].map((item) => (
                        <li key={item} className="flex gap-2.5">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cobalt" />
                            <span>{item}</span>
                        </li>
                    ))}
                </ul>
                <p>We do not sell your data, and we do not use your documents to train models.</p>
            </>
        ),
    },
    {
        title: "Document retention",
        body: (
            <p>
                Documents are held in memory only for as long as it takes to classify them
                and upload them to your Google Drive. We do not keep copies of your files.
                What we retain is the searchable index described above, which points at
                files that live in your own Drive.
            </p>
        ),
    },
    {
        title: "Your control",
        body: (
            <p>
                You can revoke DocsFlow's Google Drive access at any time from your Google
                Account permissions page. Filing stops immediately, and every document
                already filed remains in your Drive, because it was always yours. Contact
                us to request deletion of your account and index.
            </p>
        ),
    },
    {
        title: "Contact",
        body: (
            <p>
                Questions about this policy? Email{" "}
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

export default function PrivacyPolicy() {
    return (
        <LegalPage
            title="Privacy Policy"
            updated={new Date().toLocaleDateString()}
            accent="bg-lime"
            intro="Short version: your documents pass through us and land in your own Google Drive. We keep the index that makes search work, never the files themselves."
            sections={SECTIONS}
        />
    );
}
