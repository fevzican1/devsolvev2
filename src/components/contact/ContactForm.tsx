'use client';

import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

function encodeForm(values: FormData): string {
  return new URLSearchParams(
    Array.from(values.entries()).map(([key, value]) => [key, String(value)]),
  ).toString();
}

export function ContactForm() {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('idle');
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encodeForm(formData),
      });

      if (!response.ok) {
        throw new Error('Submission failed');
      }

      form.reset();
      setStatus('success');
    } catch {
      setStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      name="contact-us"
      method="POST"
      data-netlify="true"
      netlify-honeypot="bot-field"
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <input type="hidden" name="form-name" value="contact-us" />
      <p className="hidden">
        <label>
          Do not fill this out if you are human: <input name="bot-field" />
        </label>
      </p>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="fullName" className="text-sm font-medium">Full name</label>
          <Input id="fullName" name="fullName" required autoComplete="name" />
        </div>
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">Work email</label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="company" className="text-sm font-medium">Company (optional)</label>
          <Input id="company" name="company" autoComplete="organization" />
        </div>
        <div className="space-y-2">
          <label htmlFor="subject" className="text-sm font-medium">Subject</label>
          <Input id="subject" name="subject" required />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="message" className="text-sm font-medium">Message</label>
        <Textarea id="message" name="message" required rows={7} className="resize-y" />
      </div>

      <div className="flex items-start gap-3 rounded-md border bg-muted/40 p-3">
        <input id="consent" name="consent" type="checkbox" required className="mt-1" />
        <label htmlFor="consent" className="text-sm text-muted-foreground">
          This request can be used to provide support and legal communication, in line with the Privacy Policy.
        </label>
      </div>

      <div className="flex items-center gap-4">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Sending...' : 'Send Message'}
        </Button>
        {status === 'success' && (
          <p className="text-sm text-green-700 dark:text-green-400">Message received. A response will follow by email.</p>
        )}
        {status === 'error' && (
          <p className="text-sm text-destructive">Submission failed. Please retry.</p>
        )}
      </div>
    </form>
  );
}
