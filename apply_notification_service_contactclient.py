#!/usr/bin/env python3
"""
HD995 — Server-side notifications, slice 5 (final migration): route CONTACT
CLIENT ticket-creation emails in the controller. Builds on slices 1-4.

This is the last client-side notification holdout. Once it's server-side, the
client _notifyContactClient method and ALL of Emails.js are orphaned and can be
deleted (the clean-sweep follow-up).

Contact Client tickets (request type 12): the server already swaps roles so the
client becomes the ticket's originator and the creating staff member becomes the
assigned tech. On creation, email both:
  - the client    (a ticket has been raised for them)  -> ticket.Email
  - the assigned tech (the creating staff member)        -> ticket.AssignedTechEmail

Changes:
  1. INotificationService.cs:
       - add ContactClientCreated to the enum;
       - add NotifyContactClient(int ticketId, IUser user) to the interface.
  2. NotificationService.cs:
       - NotifyContactClient(): load the ticket, recipients = client + tech
         (deduped, blanks dropped), build subject/body, send.
       - add ContactClientCreated subject/body wording.
  3. TicketController.SaveTicket: when ContactClientUserId is present and the
     save CREATED a ticket, call NotifyContactClient(result.ObjectID, user).

C# CANNOT be fully built offline (no .csproj). New code passed csc syntax +
stubbed type-check + runnable logic test. ALWAYS run `dotnet build` to confirm.

Idempotent. Usage:  python3 apply_notification_service_contactclient.py [repo_root]
Requires slices 1-4 already applied.
"""

import os
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
IFACE = os.path.join(ROOT, 'Interfaces', 'Shared', 'INotificationService.cs')
SVC = os.path.join(ROOT, 'Services', 'NotificationService.cs')
CTRL = os.path.join(ROOT, 'Controllers', 'Tickets', 'TicketController.cs')


def edit(path, old, new, label, marker):
    if not os.path.exists(path):
        print(f"  [error] missing {path}")
        sys.exit(1)
    data = open(path, 'rb').read()
    if marker.encode('utf-8') in data:
        print(f"  [skip] {label}: already applied")
        return
    o, n = old.encode('utf-8'), new.encode('utf-8')
    if data.count(o) != 1:
        print(f"  [error] {label}: anchor matched {data.count(o)} (expected 1); aborting")
        print("          (this slice requires slices 1-4 applied first)")
        sys.exit(1)
    with open(path, 'wb') as fh:
        fh.write(data.replace(o, n))
    print(f"  [write] {label}")


def main():
    print("HD995 — server-side notifications (slice 5: Contact Client)")
    print(f"  repo root: {os.path.abspath(ROOT)}")

    # 1a. enum: add ContactClientCreated
    edit(
        IFACE,
        "        // An RFC was created or its assigned tech changed.\r\n"
        "        RFCAssigned,\r\n"
        "    }\r\n",
        "        // An RFC was created or its assigned tech changed.\r\n"
        "        RFCAssigned,\r\n"
        "\r\n"
        "        // A Contact Client ticket was created (client + staff notified).\r\n"
        "        ContactClientCreated,\r\n"
        "    }\r\n",
        'INotificationService.cs: add ContactClientCreated',
        marker='ContactClientCreated,',
    )

    # 1b. interface: add NotifyContactClient
    edit(
        IFACE,
        "        void NotifyRFC(int rfcId, NotificationType type);\r\n",
        "        void NotifyRFC(int rfcId, NotificationType type);\r\n"
        "\r\n"
        "        // Contact Client ticket creation: notifies the client + assigned tech.\r\n"
        "        void NotifyContactClient(int ticketId, IUser user);\r\n",
        'INotificationService.cs: add NotifyContactClient',
        marker='void NotifyContactClient(int ticketId, IUser user);',
    )

    # 2a. service: add NotifyContactClient after NotifyRFC.
    #     NotifyRFC ends with the SendMailMessage(recipients...) + catch; anchor on
    #     its unique recipients-array send line.
    edit(
        SVC,
        "                _miscManager.SendMailMessage(FromAddress, recipients, subject, body);\r\n"
        "            }\r\n"
        "            catch\r\n"
        "            {\r\n"
        "                // A notification failure must never break the originating save.\r\n"
        "            }\r\n"
        "        }\r\n",
        "                _miscManager.SendMailMessage(FromAddress, recipients, subject, body);\r\n"
        "            }\r\n"
        "            catch\r\n"
        "            {\r\n"
        "                // A notification failure must never break the originating save.\r\n"
        "            }\r\n"
        "        }\r\n"
        "\r\n"
        "        // Contact Client ticket creation. The role-swap means ticket.Email is\r\n"
        "        // the client and ticket.AssignedTechEmail is the creating staff member;\r\n"
        "        // notify both.\r\n"
        "        public void NotifyContactClient(int ticketId, IUser user)\r\n"
        "        {\r\n"
        "            try\r\n"
        "            {\r\n"
        "                if (ticketId <= 0) return;\r\n"
        "\r\n"
        "                ITicket ticket = _ticketManager.GetTicketDetail(ticketId, user);\r\n"
        "                if (ticket == null) return;\r\n"
        "\r\n"
        "                string[] recipients = new[] { ticket.Email, ticket.AssignedTechEmail }\r\n"
        "                    .Where(e => !string.IsNullOrWhiteSpace(e))\r\n"
        "                    .Distinct()\r\n"
        "                    .ToArray();\r\n"
        "                if (recipients.Length == 0) return;\r\n"
        "\r\n"
        "                string subject = BuildSubject(NotificationType.ContactClientCreated, ticketId);\r\n"
        "                string body = BuildBody(NotificationType.ContactClientCreated, ticketId);\r\n"
        "\r\n"
        "                _miscManager.SendMailMessage(FromAddress, recipients, subject, body);\r\n"
        "            }\r\n"
        "            catch\r\n"
        "            {\r\n"
        "                // A notification failure must never break the originating save.\r\n"
        "            }\r\n"
        "        }\r\n",
        'NotificationService.cs: NotifyContactClient method',
        marker='public void NotifyContactClient(int ticketId, IUser user)',
    )

    # 2b. BuildSubject: ContactClientCreated wording
    edit(
        SVC,
        "                NotificationType.RFCAssigned => $\"Assigned RFC {ticketId}\",\r\n"
        "                _ => $\"Notification - Ticket {ticketId}\",\r\n",
        "                NotificationType.RFCAssigned => $\"Assigned RFC {ticketId}\",\r\n"
        "                NotificationType.ContactClientCreated => $\"Created Ticket {ticketId}\",\r\n"
        "                _ => $\"Notification - Ticket {ticketId}\",\r\n",
        'NotificationService.cs: BuildSubject ContactClient',
        marker='NotificationType.ContactClientCreated => $"Created Ticket {ticketId}"',
    )

    # 2c. BuildBody: ContactClientCreated wording
    edit(
        SVC,
        "                NotificationType.RFCAssigned =>\r\n"
        "                    $\"RFC {ticketId} has been assigned to you. It may require your attention, please review.\",\r\n"
        "                _ => $\"Ticket {ticketId} has an update.\",\r\n",
        "                NotificationType.RFCAssigned =>\r\n"
        "                    $\"RFC {ticketId} has been assigned to you. It may require your attention, please review.\",\r\n"
        "                NotificationType.ContactClientCreated =>\r\n"
        "                    $\"Ticket {ticketId} has been raised for you. It may require your attention, please review.\",\r\n"
        "                _ => $\"Ticket {ticketId} has an update.\",\r\n",
        'NotificationService.cs: BuildBody ContactClient',
        marker='Ticket {ticketId} has been raised for you.',
    )

    # 3. SaveTicket: notify on contact-client create.
    #    Insert right before the existing update-only notify block.
    edit(
        CTRL,
        "            if (!result.IsSuccess)\r\n"
        "                return BadRequest(result.Error);\r\n"
        "\r\n"
        "            // Notify on update only: Assigned if the tech changed, else Responded.\r\n",
        "            if (!result.IsSuccess)\r\n"
        "                return BadRequest(result.Error);\r\n"
        "\r\n"
        "            // Contact Client creation: notify the client + assigned tech.\r\n"
        "            if (request.ContactClientUserId.HasValue && result.ObjectID.HasValue)\r\n"
        "                _notificationService.NotifyContactClient(result.ObjectID.Value, user);\r\n"
        "\r\n"
        "            // Notify on update only: Assigned if the tech changed, else Responded.\r\n",
        'TicketController.cs: SaveTicket calls NotifyContactClient',
        marker='_notificationService.NotifyContactClient(result.ObjectID.Value, user);',
    )

    print("Done.")
    print("  [note] run `dotnet build` to confirm.")
    print("  [note] all client-side notification code is now orphaned; clean sweep can follow.")


if __name__ == '__main__':
    main()
