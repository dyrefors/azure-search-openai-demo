import { useMemo, useState } from "react";
import { Button } from "@fluentui/react-components";
import {
    Copy24Regular,
    Checkmark24Regular,
    LightbulbFilament24Regular,
    ClipboardTextLtr24Regular,
    ThumbLike24Regular,
    ThumbDislike24Regular
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

import styles from "./Answer.module.css";
import { ChatAppResponse, getCitationFilePath, SpeechConfig } from "../../api";
import { parseAnswerToHtml } from "./AnswerParser";
import { AnswerIcon } from "./AnswerIcon";
import { SpeechOutputBrowser } from "./SpeechOutputBrowser";
import { SpeechOutputAzure } from "./SpeechOutputAzure";

interface Props {
    answer: ChatAppResponse;
    index: number;
    speechConfig: SpeechConfig;
    isSelected?: boolean;
    isStreaming: boolean;
    onCitationClicked: (filePath: string) => void;
    onThoughtProcessClicked: () => void;
    onSupportingContentClicked: () => void;
    onFollowupQuestionClicked?: (question: string) => void;
    showFollowupQuestions?: boolean;
    showSpeechOutputBrowser?: boolean;
    showSpeechOutputAzure?: boolean;
    enableFeedback?: boolean; // show thumbs and allow sending feedback
    getIdToken?: () => Promise<string | undefined>; // provider for id token when logged in
    feedbackValue?: "up" | "down"; // controlled feedback value
    onFeedbackChange?: (value: "up" | "down" | undefined) => void; // callback to parent
}

export const Answer = ({
    answer,
    index,
    speechConfig,
    isSelected,
    isStreaming,
    onCitationClicked,
    onThoughtProcessClicked,
    onSupportingContentClicked,
    onFollowupQuestionClicked,
    showFollowupQuestions,
    showSpeechOutputAzure,
    showSpeechOutputBrowser,
    enableFeedback,
    getIdToken,
    feedbackValue,
    onFeedbackChange
}: Props) => {
    const followupQuestions = answer.context?.followup_questions;
    const parsedAnswer = useMemo(() => parseAnswerToHtml(answer, isStreaming, onCitationClicked), [answer, isStreaming, onCitationClicked]);
    const { t } = useTranslation();
    const sanitizedAnswerHtml = DOMPurify.sanitize(parsedAnswer.answerHtml);
    const [copied, setCopied] = useState(false);
    const canSendFeedback = enableFeedback && typeof answer.session_state === "string" && answer.session_state !== "";

    const sendFeedback = async (value: "up" | "down") => {
        if (!canSendFeedback) return;
        try {
            const idToken = getIdToken ? await getIdToken() : undefined;
            // Lazy import to avoid circular imports at module init time
            const { postFeedbackApi } = await import("../../api/api");
            await postFeedbackApi(answer.session_state as string, index, value, idToken);
        } catch (e) {
            console.error("Failed to send feedback", e);
        }
    };

    const handleCopy = () => {
        const tempElement = document.createElement("div");
        tempElement.innerHTML = sanitizedAnswerHtml;
        tempElement.querySelectorAll("sup").forEach(node => node.remove());
        tempElement.querySelectorAll(".citationStepBadge").forEach(node => node.remove());
        const textToCopy = tempElement.textContent ?? "";

        navigator.clipboard
            .writeText(textToCopy)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            })
            .catch(err => console.error("Failed to copy text: ", err));
    };

    return (
        <div
            className={`${styles.answerContainer} ${isSelected ? styles.selected : ""}`}
            style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}
        >
            <div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <AnswerIcon />
                    <div>
                        <Button
                            appearance="transparent"
                            style={{ color: "black" }}
                            icon={copied ? <Checkmark24Regular /> : <Copy24Regular />}
                            title={copied ? t("tooltips.copied") : t("tooltips.copy")}
                            aria-label={copied ? t("tooltips.copied") : t("tooltips.copy")}
                            onClick={handleCopy}
                        />
                        {enableFeedback && (
                            <>
                                <Button
                                    appearance="transparent"
                                    style={{ color: feedbackValue === "up" ? "green" : "black" }}
                                    icon={<ThumbLike24Regular />}
                                    title={t("tooltips.feedbackUp")}
                                    aria-label={t("tooltips.feedbackUp")}
                                    disabled={isStreaming}
                                    onClick={() => {
                                        const newVal = feedbackValue === "up" ? undefined : "up";
                                        if (onFeedbackChange) onFeedbackChange(newVal);
                                        if (newVal) sendFeedback(newVal);
                                    }}
                                />
                                <Button
                                    appearance="transparent"
                                    style={{ color: feedbackValue === "down" ? "#c50f1f" : "black" }}
                                    icon={<ThumbDislike24Regular />}
                                    title={t("tooltips.feedbackDown")}
                                    aria-label={t("tooltips.feedbackDown")}
                                    disabled={isStreaming}
                                    onClick={() => {
                                        const newVal = feedbackValue === "down" ? undefined : "down";
                                        if (onFeedbackChange) onFeedbackChange(newVal);
                                        if (newVal) sendFeedback(newVal);
                                    }}
                                />
                            </>
                        )}
                        <Button
                            appearance="transparent"
                            style={{ color: "black" }}
                            icon={<LightbulbFilament24Regular />}
                            title={t("tooltips.showThoughtProcess")}
                            aria-label={t("tooltips.showThoughtProcess")}
                            onClick={() => onThoughtProcessClicked()}
                            disabled={!answer.context.thoughts?.length || isStreaming}
                        />
                        <Button
                            appearance="transparent"
                            style={{ color: "black" }}
                            icon={<ClipboardTextLtr24Regular />}
                            title={t("tooltips.showSupportingContent")}
                            aria-label={t("tooltips.showSupportingContent")}
                            onClick={() => onSupportingContentClicked()}
                            disabled={!answer.context.data_points || isStreaming}
                        />
                        {showSpeechOutputAzure && (
                            <SpeechOutputAzure answer={sanitizedAnswerHtml} index={index} speechConfig={speechConfig} isStreaming={isStreaming} />
                        )}
                        {showSpeechOutputBrowser && <SpeechOutputBrowser answer={sanitizedAnswerHtml} />}
                    </div>
                </div>
            </div>

            <div style={{ flexGrow: 1 }}>
                <div className={styles.answerText}>
                    <ReactMarkdown children={sanitizedAnswerHtml} rehypePlugins={[rehypeRaw]} remarkPlugins={[remarkGfm]} />
                </div>
            </div>

            {!!parsedAnswer.citations.length && (
                <div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                        <span className={styles.citationLearnMore}>{t("citationWithColon")}</span>
                        {parsedAnswer.citations.map(citation => {
                            const isWeb = citation.isWeb;
                            const displayIndex = citation.index;
                            const reference = citation.reference;
                            if (isWeb) {
                                // Attempt to find the matching web data point to retrieve its title
                                const webEntry = answer.context.data_points.external_results_metadata?.find(w => w.url === reference);
                                const titleOrUrl = webEntry?.title?.trim() ? webEntry.title : reference;
                                return (
                                    <span key={`${reference}-${displayIndex}`} className={styles.citationEntry}>
                                        <a className={styles.citation} title={reference} href={reference} target="_blank" rel="noopener noreferrer">
                                            {`${displayIndex}. ${titleOrUrl}`}
                                        </a>
                                    </span>
                                );
                            } else {
                                const path = getCitationFilePath(reference);
                                return (
                                    <span key={`${reference}-${displayIndex}`} className={styles.citationEntry}>
                                        <a
                                            className={styles.citation}
                                            title={reference}
                                            onClick={e => {
                                                e.preventDefault();
                                                onCitationClicked(path);
                                            }}
                                        >
                                            {`${displayIndex}. ${reference}`}
                                        </a>
                                    </span>
                                );
                            }
                        })}
                    </div>
                </div>
            )}

            {!!followupQuestions?.length && showFollowupQuestions && onFollowupQuestionClicked && (
                <div>
                    <div
                        style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}
                        className={`${!!parsedAnswer.citations.length ? styles.followupQuestionsList : ""}`}
                    >
                        <span className={styles.followupQuestionLearnMore}>{t("followupQuestions")}</span>
                        {followupQuestions.map((x, i) => {
                            return (
                                <a key={i} className={styles.followupQuestion} title={x} onClick={() => onFollowupQuestionClicked(x)}>
                                    {`${x}`}
                                </a>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
