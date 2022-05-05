// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

/**
 * Login
 */
Cypress.Commands.add('login', (username = 'admin', password = 'admin') => {
    cy.request({
        method: 'POST',
        url: '/system/auth/login/',
        body: {
            username,
            password
        }
    })
        .as('loginResponse')
        .then(response => {
            Cypress.env('authToken', response.headers.authentication);
            return response;
        })
        .its('status')
        .should('eq', 200);
});

/**
 * Create models
 */
Cypress.Commands.add('os4request', (osAction, body) => {
    return cy
        .request({
            method: 'POST',
            url: '/system/action/handle_request',
            body: [
                {
                    action: osAction,
                    data: [
                        {
                            ...body
                        }
                    ]
                }
            ]
        })
        .should(response => {
            expect(response.status).to.eq(200);
        })
        .its('body')
        .should('contain', {
            success: true
        })
        .then(body => {
            return body.results[0][0];
        });
});

/**
 * Get a specific element for `data-cy`
 */
Cypress.Commands.add('getElement', (name: string) => {
    return cy.get(`[data-cy=${name}]`);
});

Cypress.Commands.add('getAnchorFor', (url: string) => {
    return cy.get(`a[href=\"${url}\"]`);
});

Cypress.Commands.add('clearDatabase', () => {
    cy.request({
        method: 'POST',
        url: 'http://localhost:9011/internal/datastore/writer/truncate_db',
        headers: ['Content-Type: application/json']
    }).should(response => {
        expect(response.status).to.eq(204);
    });
});

Cypress.Commands.add('createDefaultUser', () => {
    cy.request({
        method: 'POST',
        url: 'http://localhost:9011/internal/datastore/writer/write',
        headers: ['Content-Type: application/json'],
        body: {
            user_id: 1,
            information: {},
            locked_fields: {},
            events: [
                {
                    type: 'create',
                    fqid: 'user/1',
                    fields: {
                        id: 1,
                        is_active: true,
                        organization_management_level: 'can_manage_organization',
                        first_name: 'Administrator',
                        username: 'admin',
                        password:
                            '316af7b2ddc20ead599c38541fbe87e9a9e4e960d4017d6e59de188b41b2758flD5BVZAZ8jLy4nYW9iomHcnkXWkfk3PgBjeiTSxjGG7+fBjMBxsaS1vIiAMxYh+K38l0gDW4wcP+i8tgoc4UBg=='
                    }
                }
            ]
        }
    });
});

Cypress.Commands.add('createSuperUser', () => {
    cy.request({
        method: 'POST',
        url: 'http://localhost:9011/internal/datastore/writer/write',
        headers: ['Content-Type: application/json'],
        body: {
            user_id: 2,
            information: {},
            locked_fields: {},
            events: [
                {
                    type: 'create',
                    fqid: 'user/2',
                    fields: {
                        id: 2,
                        is_active: true,
                        organization_management_level: 'superadmin',
                        first_name: 'superadmin',
                        username: 'superadmin',
                        password:
                            'cc1f22aa8d672477a48552084d00abbfef2f7562a77a277271c69c3cefa475ffgM3diieK90eekCBxyxCBRdGCVX/GAlE7ti0u+yjMrXhaqw6Z90OjpT4c6jG0GuqBn8OGf6aj9fR5eqgLJAVe3g=='
                    }
                }
            ]
        }
    });
});

Cypress.Commands.add('createCommittee', (name: string = Date.now().toString()) => {
    const committeeData = {
        organization_id: 1,
        name,
        user_$_management_level: { can_manage: [1] }
    };
    cy.os4request('committee.create', committeeData).then(res => ({ id: res.id, name }));
});

/**
 * Extend "request" with auth header
 */
Cypress.Commands.overwrite('request', (originalFn, ...options) => {
    const optionsObject = options[0];
    const token = Cypress.env('authToken');
    if (!!token && optionsObject === Object(optionsObject)) {
        optionsObject.headers = {
            authentication: token,
            ...optionsObject.headers
        };
        return originalFn(optionsObject);
    }
    return originalFn(...options);
});