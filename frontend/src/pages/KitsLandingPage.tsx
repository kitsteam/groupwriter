import { Link, useNavigate } from 'react-router';
import { createDocument } from '../utils/serverRequests';
import { getLocalMostRecentThreeDocuments } from '../utils/localstorage';
import { useTranslation } from 'react-i18next';
import { FlashMessage } from '../components/FlashMessage';

function LandingPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const sortedDocuments = getLocalMostRecentThreeDocuments();

  return (
    <div className="flex flex-row items-center h-screen w-screen font-kits">
      <div className="hidden lg:flex lg:flex-col lg:w-1/2 lg:h-full lg:justify-center bg-gradient-to-b from-secondary to-primary">
        <div className="flex-1"></div>
        <div className="self-center">
          <img
            src="/images/logo.svg"
            alt="GroupWriter Logo"
            className="opacity-75 w-1/4 m-auto"
          />
        </div>
        <div className="flex-1"></div>
        <div className="mt-auto mb-2 text-center w-full">
          <a
            href="https://github.com/kitsteam/groupwriter"
            className="text-white p-2 text-decoration-none"
          >
            GitHub
          </a>
          <a
            href={import.meta.env.VITE_LEGAL_URL}
            className="text-white p-2 text-decoration-none"
          >
            Impressum
          </a>
          <a
            href={import.meta.env.VITE_PRIVACY_STATEMENT_URL}
            className="text-white p-2 text-decoration-none"
          >
            Datenschutz
          </a>
        </div>
      </div>
      <div className="flex flex-col w-full lg:w-1/2 h-full">
        <div className="lg:flex-1 self-end">
          <img
            src="/images/publisher-logo.svg"
            alt="Kits Logo"
            className="w-3/4 justify-self-end mt-4 me-4"
          />
        </div>
        <div className="ms-12 mt-8 lg:mt-0">
          <h1 className="text-secondary font-bold text-4xl mb-2">
            GroupWriter
          </h1>
          <FlashMessage />
          <ul className="list-none leading-8 border-s-4 border-primary mb-4">
            <li className="ps-4">Verfasse Texte in Gruppen!</li>
            <li className="ps-4">Kommentiere Texte!</li>
            <li className="ps-4">Füge Bilder hinzu!</li>
          </ul>
          <button
            type="submit"
            className="bg-secondary text-white p-2 w-auto"
            onClick={() => {
              void (async () => {
                const link = await createDocument();
                if (link) await navigate(link);
              })();
            }}
          >
            {t('page.landing.buttons.new')}
          </button>
          <p className="text-neutral-500 mt-4 text-xs">
            Dieses Tool darf nur in Bildungskontexten genutzt werden. Die
            Eingabe sensibler Daten ist zu vermeiden.
          </p>
          <br />
          <p className="text-neutral-500 text-xs">
            Achtung: Texte werden 24 Monate nach der letzten Bearbeitung
            gelöscht!
          </p>
          <br />
          <br />
          <div className="text-kits-body-color">Letzte Texte:</div>
          <ul className="list-none text-secondary">
            {Object.values(sortedDocuments).map((document) => (
              <li key={document.id} className="text-sm">
                <Link
                  to={{
                    pathname: `/document/${document.id}`,
                    hash: document.modificationSecret
                  }}
                >
                  {document?.createdAt && (
                    <span>
                      Text vom {new Date(document?.createdAt).toLocaleString()}
                    </span>
                  )}
                </Link>
              </li>
            ))}
            {Object.values(sortedDocuments).length === 0 && (
              <li className="text-sm">-</li>
            )}
          </ul>
        </div>
        <div className="flex flex-1 justify-center">
          <div className="flex lg:hidden mt-auto text-white bg-gradient-to-b from-secondary to-primary w-full pe-4">
            <div className="justify-start m-4">
              <img
                src="/images/logo.svg"
                alt="Kits Logo"
                className="w-12 opacity-75"
              />
            </div>
            <div className="flex grow justify-end content-center flex-wrap">
              <a
                href="https://github.com/kitsteam/groupwriter-frontend"
                className="p-2 text-decoration-none"
              >
                GitHub
              </a>
              <a
                href="https://kits.blog/impressum/"
                className="p-2 text-decoration-none"
              >
                Impressum
              </a>
              <a
                href="https://kits.blog/datenschutz/#groupwriter"
                className="p-2 text-decoration-none"
              >
                Datenschutz
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
