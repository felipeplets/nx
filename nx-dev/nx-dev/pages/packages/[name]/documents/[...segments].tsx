import { DocumentsApi } from '@nrwl/nx-dev/data-access-documents/node-only';
import { getPackagesSections } from '@nrwl/nx-dev/data-access-menu';
import { sortCorePackagesFirst } from '@nrwl/nx-dev/data-access-packages';
import { DocViewer } from '@nrwl/nx-dev/feature-doc-viewer';
import {
  ProcessedDocument,
  RelatedDocument,
} from '@nrwl/nx-dev/models-document';
import { Menu, MenuItem, MenuSection } from '@nrwl/nx-dev/models-menu';
import { ProcessedPackageMetadata } from '@nrwl/nx-dev/models-package';
import { DocumentationHeader, SidebarContainer } from '@nrwl/nx-dev/ui-common';
import { GetStaticPaths } from 'next';
import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import { menusApi } from '../../../../lib/menus.api';
import { useNavToggle } from '../../../../lib/navigation-toggle.effect';
import { nxPackagesApi } from '../../../../lib/packages.api';
import { tagsApi } from '../../../../lib/tags.api';

export default function PackageDocument({
  document,
  menu,
  relatedDocuments,
}: {
  document: ProcessedDocument;
  menu: MenuItem[];
  pkg: ProcessedPackageMetadata;
  relatedDocuments: RelatedDocument[];
}): JSX.Element {
  const router = useRouter();
  const { toggleNav, navIsOpen } = useNavToggle();
  const wrapperElement = useRef(null);

  useEffect(() => {
    const handleRouteChange = (url: string) => {
      if (url.includes('#')) return;
      if (!wrapperElement) return;

      (wrapperElement as any).current.scrollTo({
        top: 0,
        left: 0,
        behavior: 'smooth',
      });
    };

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => router.events.off('routeChangeComplete', handleRouteChange);
  }, [router, wrapperElement]);

  const vm: {
    document: ProcessedDocument;
    menu: Menu;
    relatedDocuments: RelatedDocument[];
  } = {
    document,
    menu: {
      sections: sortCorePackagesFirst<MenuSection>(
        getPackagesSections(menu),
        'id'
      ),
    },
    relatedDocuments,
  };

  return (
    <div id="shell" className="flex h-full flex-col">
      <div className="w-full flex-shrink-0">
        <DocumentationHeader isNavOpen={navIsOpen} toggleNav={toggleNav} />
      </div>
      <main
        id="main"
        role="main"
        className="flex h-full flex-1 overflow-y-hidden"
      >
        <SidebarContainer menu={vm.menu} navIsOpen={navIsOpen} />
        <div
          ref={wrapperElement}
          id="wrapper"
          data-testid="wrapper"
          className="relative flex flex-grow flex-col items-stretch justify-start overflow-y-scroll"
        >
          <DocViewer
            document={vm.document}
            relatedDocuments={vm.relatedDocuments}
          />
        </div>
      </main>
    </div>
  );
}

export const getStaticPaths: GetStaticPaths = () => {
  return {
    paths: [
      ...nxPackagesApi.getStaticDocumentPaths().documents.map((x) => ({
        params: {
          name: x.params.segments.slice(1)[0],
          segments: x.params.segments.slice(3),
        },
      })),
    ],
    fallback: 'blocking',
  };
};

export async function getStaticProps({
  params,
}: {
  params: { name: string; segments: string[] };
}) {
  try {
    const documents = new DocumentsApi({
      id: [params.name, 'documents'].join('-'),
      manifest: nxPackagesApi.getPackageDocuments(params.name),
      prefix: '',
      publicDocsRoot: 'nx-dev/nx-dev/public/documentation',
      tagsApi,
    });
    const document = documents.getDocument([
      'packages',
      params.name,
      'documents',
      ...params.segments,
    ]);

    return {
      props: {
        pkg: nxPackagesApi.getPackage([params.name]),
        document,
        relatedDocuments: tagsApi.getAssociatedItemsFromTags(document.tags),
        menu: menusApi.getMenu('packages', ''),
      },
    };
  } catch (e) {
    return {
      notFound: true,
      props: {
        statusCode: 404,
      },
    };
  }
}
